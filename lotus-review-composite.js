(() => {
  const size = 1280;

  function buffer() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    return canvas.getContext('2d');
  }

  function contained(ctx, image) {
    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  }

  // The mask shapes only the light in front of the original illustration.
  function cupMask([x, y, rx, ry, bottom]) {
    const ctx = buffer();
    ctx.save();
    ctx.translate(size*x, size*y);
    ctx.scale(size*rx, size*ry);
    const fade = ctx.createRadialGradient(0, 0, .21, 0, 0, 1);
    for (const [at, a] of [[0,.71],[.46,.65],[.69,.39],[.9,.12],[1,0]]) {
      fade.addColorStop(at, 'rgba(255,255,255,'+a+')');
    }
    ctx.fillStyle = fade;
    ctx.fillRect(-1,-1,2,2);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-in';
    const cutoff = ctx.createLinearGradient(0,(bottom-.052)*size,0,bottom*size);
    cutoff.addColorStop(0, '#fff');
    cutoff.addColorStop(1, 'transparent');
    ctx.fillStyle = cutoff;
    ctx.fillRect(0,0,size,size);
    return ctx.canvas;
  }

  const far = buffer();
  const near = buffer();
  const sky = far.createLinearGradient(0, 0, 0, .105*size);
  sky.addColorStop(0, 'transparent');
  sky.addColorStop(.16, 'transparent');
  sky.addColorStop(.54, 'rgba(255,255,255,.48)');
  sky.addColorStop(1, '#fff');
  let projectedFrame = null;

  function project(image) {
    if (image === projectedFrame) return far.canvas;
    far.clearRect(0,0,size,size);
    far.drawImage(image,0,0,size,size);
    far.globalCompositeOperation = 'destination-in';
    far.fillStyle = sky;
    far.fillRect(0,0,size,size);
    far.globalCompositeOperation = 'source-over';
    projectedFrame = image;
    return far.canvas;
  }

  function flames(ctx, image, mask, front, strength) {
    if (!image) return;
    const projection = project(image);
    ctx.save();
    ctx.globalAlpha = strength;
    if (front) {
      near.clearRect(0,0,size,size);
      near.drawImage(projection,0,0);
      near.globalCompositeOperation = 'destination-in';
      near.drawImage(mask,0,0);
      near.globalCompositeOperation = 'source-over';
      ctx.drawImage(near.canvas,0,0);
    } else {
      ctx.drawImage(projection,0,0);
    }
    ctx.restore();
  }

  function paint(ctx, {body, profile, mask, fire, cold, t, dark = false, showFire = true, snow = true, mist = true}) {
    ctx.clearRect(0, 0, size, size);
    if (cold && mist) LotusReviewEffects.coldAir(ctx, t, dark);
    if (showFire && cold) {
      ColdLotusCore.draw(ctx, fire, false);
      drawLotusLight(ctx, t * 1000, false, dark, true);
    } else if (showFire) {
      flames(ctx, fire, mask, false, 1);
      LotusReviewEffects.embers(ctx, t, profile, dark, false);
    }
    contained(ctx, body);
    if (showFire && cold) {
      ColdLotusCore.draw(ctx, fire, true);
      drawLotusLight(ctx, t * 1000, true, dark, true);
    } else if (showFire) {
      flames(ctx, fire, mask, true, .70);
      LotusReviewEffects.embers(ctx, t, profile, dark, true);
    }
    if (cold && snow) LotusReviewEffects.flakes(ctx, t, dark);
  }

  window.LotusReviewComposite = {cupMask, paint};
})();
