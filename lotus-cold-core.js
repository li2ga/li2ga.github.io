// Register the projected volume to the crystalline cup, then let the front petals
// occlude it. A soft window admits the near half of the central plume into the cup.
(() => {
  const size = 1280;
  const near = document.createElement('canvas');
  near.width = near.height = size;
  const cup = near.getContext('2d');
  const mask = document.createElement('canvas');
  mask.width = mask.height = size;
  const matte = mask.getContext('2d');
  matte.save();matte.translate(640,502);matte.scale(120,172);
  const fade=matte.createRadialGradient(0,0,.27,0,0,1);
  for(const [at,alpha] of [[0,.83],[.53,.77],[.72,.55],[.88,.20],[1,0]])fade.addColorStop(at,`rgba(255,255,255,${alpha})`);
  matte.fillStyle=fade;matte.fillRect(-1,-1,2,2);matte.restore();
  // Below the inner-cup lip, the foreground crystal must stay unlit by the plume.
  matte.globalCompositeOperation='destination-in';
  const lip=matte.createLinearGradient(0,588,0,657);
  lip.addColorStop(0,'#fff');lip.addColorStop(.42,'rgba(255,255,255,.74)');lip.addColorStop(1,'rgba(255,255,255,0)');
  matte.fillStyle=lip;matte.fillRect(0,0,size,size);
  let rendered;
  function update(image){
    if(rendered===image)return;
    rendered=image;
    cup.clearRect(0,0,size,size);
    cup.drawImage(image,0,0);
    cup.globalCompositeOperation='destination-in';cup.drawImage(mask,0,0);
    cup.globalCompositeOperation='source-over';
  }
  function draw(c, image, front){
    if(!image)return;
    if(front)update(image);
    c.drawImage(front?near:image,0,0);
  }
  window.ColdLotusCore = {draw};
})();