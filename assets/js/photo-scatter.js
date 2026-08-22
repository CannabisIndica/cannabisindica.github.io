(function () {
  var dataEl = document.getElementById("photo-data");
  var wall = document.getElementById("photo-scatter");
  if (!dataEl || !wall) return;

  var photos;
  try {
    photos = JSON.parse(dataEl.textContent);
  } catch (e) {
    console.error("photo-scatter: could not parse photo data", e);
    return;
  }

  // Excel's "CSV UTF-8" export prepends a hidden BOM character to the first
  // column's header, which would otherwise silently turn "image_number" into
  // "\ufeffimage_number" and break everything downstream. Strip it here.
  function stripBOM(str) {
    return str.replace(/^\uFEFF/, "").trim();
  }

  photos = photos.map(function (row) {
    var clean = {};
    Object.keys(row).forEach(function (key) {
      clean[stripBOM(key)] = row[key];
    });
    return clean;
  });

  var missingImageNumber = photos.filter(function (p) {
    return !p.image_number;
  });
  if (missingImageNumber.length) {
    console.warn(
      "photo-scatter: " +
        missingImageNumber.length +
        " row(s) in _data/photos.csv are missing image_number. " +
        "Check the CSV header row for typos, extra spaces, or a stray BOM.",
      missingImageNumber
    );
  }

  // Fisher-Yates shuffle — re-run on every page load/refresh
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function randBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  // Possible cell widths (in grid columns). Weighted so most tiles stay
  // narrow and a few randomly get pulled out as wider feature tiles —
  // re-rolled fresh on every page load. Row height is NOT randomized here;
  // it's computed per-image from its real aspect ratio once it loads, so
  // photos are never cropped or letterboxed.
  var COL_OPTIONS = [
    { col: 1, weight: 5 },
    { col: 2, weight: 2 },
  ];
  var WEIGHTED_COLS = COL_OPTIONS.reduce(function (acc, opt) {
    for (var i = 0; i < opt.weight; i++) acc.push(opt.col);
    return acc;
  }, []);

  function randomColSpan() {
    return WEIGHTED_COLS[Math.floor(Math.random() * WEIGHTED_COLS.length)];
  }

  // Reads the grid's row height + gap straight from CSS so this stays in
  // sync if you ever tweak --row-unit / gap in the stylesheet.
  function getGridMetrics() {
    var styles = getComputedStyle(wall);
    var rowUnit = parseFloat(styles.getPropertyValue("--row-unit")) || 10;
    var gap = parseFloat(styles.rowGap) || parseFloat(styles.gap) || 0;
    return { rowUnit: rowUnit, gap: gap };
  }

  // Sizes a tile's grid-row span so its height matches the image's real
  // aspect ratio at its current rendered width — no crop, no empty space.
  function sizeTileToImage(tile, img) {
    if (!img.naturalWidth || !img.naturalHeight) return;
    var metrics = getGridMetrics();
    var width = tile.getBoundingClientRect().width;
    var aspect = img.naturalWidth / img.naturalHeight;
    var neededHeight = width / aspect;
    var rowSpan = Math.max(
      1,
      Math.round((neededHeight + metrics.gap) / (metrics.rowUnit + metrics.gap))
    );
    tile.style.gridRowEnd = "span " + rowSpan;
  }

  var shuffled = shuffle(photos);

  // Spreadsheet only gives the bare image number (e.g. "0231").
  // Actual filenames on disk are DSFC0231.jpg
  function filenameFor(photo) {
    return "DSCF" + photo.image_number + ".jpg";
  }

  var frag = document.createDocumentFragment();
  var tilePairs = [];

  shuffled.forEach(function (photo, idx) {
    var tile = document.createElement("div");
    tile.className = "photo-tile";
    tile.tabIndex = 0;
    tile.setAttribute("role", "button");
    tile.setAttribute(
      "aria-label",
      "Open " + (photo.title || "photo") + " in full size"
    );

    // Random cell width, re-rolled every page load. Height is set once the
    // image finishes loading (see sizeTileToImage) to match its real aspect
    // ratio, so nothing gets cropped or letterboxed.
    tile.style.gridColumn = "span " + randomColSpan();

    var img = document.createElement("img");
    img.src = "/images/photography/thumbs/" + filenameFor(photo);
    img.alt = photo.title || filenameFor(photo);
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("load", function () {
      sizeTileToImage(tile, img);
    });
    tile.appendChild(img);

    var caption = document.createElement("div");
    caption.className = "photo-tile-caption";
    caption.textContent = photo.title || filenameFor(photo);
    tile.appendChild(caption);

    function open() {
      openLightbox(photo);
    }
    tile.addEventListener("click", open);
    tile.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    tilePairs.push({ tile: tile, img: img });
    frag.appendChild(tile);
  });

  wall.appendChild(frag);

  // Column widths shift on window resize (responsive grid), which changes
  // how tall each cell needs to be to keep matching its image's aspect
  // ratio — recompute all of them, debounced so it doesn't run on every
  // pixel of a drag-resize.
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      tilePairs.forEach(function (pair) {
        sizeTileToImage(pair.tile, pair.img);
      });
    }, 150);
  });

  // ---------- Lightbox ----------

  var lightbox = document.createElement("div");
  lightbox.className = "photo-lightbox";
  lightbox.innerHTML =
    '<div class="photo-lightbox-panel" role="dialog" aria-modal="true">' +
    '<button class="photo-lightbox-close" aria-label="Close">&times;</button>' +
    '<img alt="">' +
    '<div class="photo-lightbox-meta"></div>' +
    "</div>";
  document.body.appendChild(lightbox);

  var panel = lightbox.querySelector(".photo-lightbox-panel");
  var lightboxImg = lightbox.querySelector("img");
  var metaBox = lightbox.querySelector(".photo-lightbox-meta");
  var closeBtn = lightbox.querySelector(".photo-lightbox-close");
  var lastFocused = null;

  // Fields shown as metadata, in order. Skip "image_number" (used to build
  // the filename) and "title" (shown as the heading instead).
  var METADATA_FIELDS = ["day", "location"];
  var FIELD_LABELS = {
    day: "Day",
    location: "Location",
  };

  function openLightbox(photo) {
    lastFocused = document.activeElement;
    var filename = filenameFor(photo);
    var thumbSrc = "/images/photography/thumbs/" + filename;
    var fullSrc = "/images/photography/" + filename;

    // Show the (already-downloaded) thumbnail instantly so the lightbox
    // never looks empty, then swap in the full-res version once it's
    // finished loading in the background.
    lightboxImg.src = thumbSrc;
    lightboxImg.alt = photo.title || filename;
    lightboxImg.classList.add("is-loading-full");

    var fullImg = new Image();
    fullImg.onload = function () {
      lightboxImg.src = fullSrc;
      lightboxImg.classList.remove("is-loading-full");
    };
    fullImg.src = fullSrc;

    var html = "<h3>" + (photo.title || filename) + "</h3><dl>";
    METADATA_FIELDS.forEach(function (field) {
      if (photo[field]) {
        html +=
          "<dt>" +
          (FIELD_LABELS[field] || field) +
          "</dt><dd>" +
          photo[field] +
          "</dd>";
      }
    });
    html += "</dl>";
    metaBox.innerHTML = html;

    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  }

  closeBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
    }
  });
  panel.addEventListener("click", function (e) {
    e.stopPropagation();
  });
})();