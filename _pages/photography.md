---
title: "Photography"
permalink: /photography/
author_profile: true
---

All pictures takes by yours truly on Fujifilm X-H1. Click a photo to see it larger with extra details.

<link rel="stylesheet" href="{{ '/assets/css/photo-scatter.css' | relative_url }}">

<div id="photo-scatter" class="photo-scatter"></div>

<script id="photo-data" type="application/json">
{{ site.data.photos | jsonify }}
</script>
<script src="{{ '/assets/js/photo-scatter.js' | relative_url }}" defer></script>
