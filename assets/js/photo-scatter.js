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

  // Possible cell sizes (in grid-column/row spans). Weighted so most tiles
  // stay small and a few randomly get pulled out as bigger feature tiles —
  // re-rolled fresh on every page load.
  var SIZE_OPTIONS = [
    { col: 1, row: 1, weight: 5 },
    { col: 2, row: 1, weight: 2 },
    { col: 1, row: 2, weight: 2 },
    { col: 2, row: 2, weight: 1 },
  ];
  var WEIGHTED_SIZES = SIZE_OPTIONS.reduce(function (acc, opt) {
    for (var i = 0; i < opt.weight; i++) acc.push(opt);
    return acc;
  }, []);

  function randomSize() {
    return WEIGHTED_SIZES[Math.floor(Math.random() * WEIGHTED_SIZES.length)];
  }

  var shuffled = shuffle(photos);

  // Spreadsheet only gives the bare image number (e.g. "0231").
  // Actual filenames on disk are DSFC0231.jpg
  function filenameFor(photo) {
    return "DSFC" + photo.image_number + ".jpg";
  }

  var frag = document.createDocumentFragment();

  shuffled.forEach(function (photo, idx) {
    var tile = document.createElement("div");
    tile.className = "photo-tile";
    tile.tabIndex = 0;
    tile.setAttribute("role", "button");
    tile.setAttribute(
      "aria-label",
      "Open " + (photo.title || "photo") + " in full size"
    );

    // Random cell size within the grid, re-rolled every page load
    var size = randomSize();
    tile.style.gridColumn = "span " + size.col;
    tile.style.gridRow = "span " + size.row;

    var img = document.createElement("img");
    img.src = "/images/photography/" + filenameFor(photo);
    img.alt = photo.title || filenameFor(photo);
    img.loading = "lazy";
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

    frag.appendChild(tile);
  });

  wall.appendChild(frag);

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
    lightboxImg.src = "/images/photography/" + filename;
    lightboxImg.alt = photo.title || filename;

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
