(() => {
  const size = 1280;
  const metalwork = new Set([ 'destruction', 'radial', 'formation', 'refined', 'branches']);

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

  function silhouette(ctx, points) {
    ctx.beginPath();
    for (const [x, y] of points) ctx.lineTo(x * size, y * size);
    ctx.closePath();
    ctx.fill();
  }

  function plate(image, profile, key) {
    const ctx = buffer(), mask = buffer();
    contained(ctx, image);
    if (key === 'rings') {
      // Keep every metal strand. Remove only the loose painted wisps above
      // the crown, between the two metal bands.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.filter = 'blur(10px)';
      for (const [x,y,rx,ry,angle] of [[.611,.142,.034,.065,.34],[.678,.151,.041,.073,.47]]) {
        ctx.beginPath();
        ctx.ellipse(x*size,y*size,rx*size,ry*size,angle,0,Math.PI*2);
        ctx.fill();
      }
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      return ctx.canvas;
    }
    mask.filter = key === 'emperor' ? 'blur(20px)' : 'blur(9px)';
    silhouette(mask, profile.edge || profile.body);

    // The warm and silver structure is retained separately from the loose
    // painted flames. The matte is applied to the display copy only.
    if (metalwork.has(key)) {
      const src = ctx.getImageData(0, 0, size, size).data;
      const coverage = mask.getImageData(0, 0, size, size);
      const dst = coverage.data;
      for (let i = 0; i < src.length; i += 4) {
        if (dst[i + 3] > 248 || src[i + 3] < 36) continue;
        const [r, g, b, alpha] = [src[i], src[i + 1], src[i + 2], src[i + 3]];
        const warm = Math.max(0, Math.min(1, (g - b + 4) / 17)) * Math.min(1, r / 155);
        const retained = warm;
        dst[i + 3] = Math.max(dst[i + 3], Math.round(retained * Math.min(1, (alpha - 36) / 70) * 255));
      }
      mask.putImageData(coverage, 0, 0);
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return ctx.canvas;
  }

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

  window.LotusReviewComposite = {contained, plate, cupMask, flames};
})();
