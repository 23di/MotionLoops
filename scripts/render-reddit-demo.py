"""Assemble a square showcase from real Motion Loops scene samples."""
import json, os, pathlib, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageChops

scene=json.loads(pathlib.Path(sys.argv[1]).read_text())
out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
W=H=1080
PAPER='#ebe9e1';INK='#191c1b';MUTED='#6c716d';STAGE='#161b19'
fontpath=os.environ.get('MOTION_DEMO_FONT') or next((p for p in ['/System/Library/Fonts/Helvetica.ttc','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'] if pathlib.Path(p).exists()),None)
def font(size,bold=False):
    return ImageFont.truetype(fontpath,size,index=1 if bold and fontpath.endswith('.ttc') else 0) if fontpath else ImageFont.load_default(size=size)
colors=['#d7fa63','#fa8c71','#a9a1f5','#9cddd6','#f5c96a','#eabfe0']
labels=['FORM','SPACE','MOTION','LOOP','FLOW','PLAY']

def artwork(i):
    im=Image.new('RGBA',(510,660),colors[i]);d=ImageDraw.Draw(im)
    d.text((34,30),f'0{i+1}',font=font(28,True),fill=INK)
    d.text((34,581),labels[i],font=font(53,True),fill=INK)
    d.line((34,564,476,564),fill=INK,width=2)
    # Authored geometric artwork, with distinct silhouettes at small sizes.
    if i%3==0:
        for y in [130,220,310]:
            d.rounded_rectangle((55,y,455,y+140),radius=70,outline=INK,width=18)
        d.ellipse((179,239,331,391),fill=colors[i],outline=INK,width=18)
    elif i%3==1:
        for r in range(205,30,-27):
            d.ellipse((255-r,335-r,255+r,335+r),outline=INK,width=9)
        d.rectangle((246,120,266,550),fill=colors[i])
    else:
        for x,y in [(70,150),(255,150),(70,335),(255,335)]:
            d.pieslice((x,y,x+185,y+185),0,270,fill=INK)
    mask=Image.new('L',im.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,509,659),radius=24,fill=255)
    im.putalpha(mask)
    return im
art=[artwork(i) for i in range(6)]
base=Image.new('RGB',(W,H),PAPER);d=ImageDraw.Draw(base)
d.text((60,47),'Motion Loops',font=font(62,True),fill=INK)
d.text((62,127),'Animation presets for Figma Motion.',font=font(26),fill=MUTED)
d.rounded_rectangle((60,204,1020,854),radius=26,fill=STAGE)
d.text((60,1014),'Native keyframes. Fully editable.',font=font(24),fill=MUTED)
d.text((865,1014),'FREE PLUGIN',font=font(18,True),fill=INK)
# Top-right mark: the same looping idea as the moving cards.
for x in (928,951,974):d.ellipse((x,63,x+30,93),outline=INK,width=3)

process=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pixel_format','rgb24','-video_size','1080x1080','-framerate',str(scene['fps']),'-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'motion-loops-reddit.mp4')],stdin=subprocess.PIPE)
contact=[]
try:
    for n,frame in enumerate(scene['frames']):
        image=base.copy();d=ImageDraw.Draw(image)
        chapter=frame['chapter'];name=scene['chapters'][chapter]['label']
        stage=Image.new('RGBA',(scene['width'],scene['height']))
        for card in frame['cards']:
            alpha=card.get('opacity',1)
            if alpha<.003 or card['width']<1 or card['height']<1:continue
            if card['x']+card['width']<0 or card['x']-card['width']>scene['width']:continue
            if card['y']+card['height']<0 or card['y']-card['height']>scene['height']:continue
            cw=min(3000,max(1,round(card['width'])));ch=min(3000,max(1,round(card['height'])))
            tile=art[card['source']%6].resize((cw,ch),Image.Resampling.LANCZOS)
            shade=card.get('shade',0)
            if shade:
                shade_layer=Image.new('RGBA',tile.size,(0,0,0,round(255*shade)))
                shade_layer.putalpha(tile.getchannel('A').point(lambda x:round(x*shade)))
                tile=Image.alpha_composite(tile,shade_layer)
            if alpha<1:tile.putalpha(tile.getchannel('A').point(lambda x:round(x*alpha)))
            tile=tile.rotate(-card['rotation'],Image.Resampling.BICUBIC,expand=True)
            stage.alpha_composite(tile,(round(card['x']-tile.width/2),round(card['y']-tile.height/2)))
        mask=Image.new('L',stage.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,959,649),radius=26,fill=255)
        # Preserve card transparency while clipping to the rounded stage.
        stage.putalpha(ImageChops.multiply(stage.getchannel('A'),mask))
        image.paste(stage,(60,204),stage)
        d=ImageDraw.Draw(image)
        # Opaque chapter badge keeps the label readable when cards sweep past it.
        d.rounded_rectangle((78,220,340,258),radius=12,fill=STAGE)
        d.text((93,230),f'0{chapter+1} / {name.upper()}',font=font(17,True),fill='#b8c1ba')
        for i,chdef in enumerate(scene['chapters']):
            x=60+i*245;active=i==chapter
            d.rounded_rectangle((x,887,x+226,956),radius=17,fill=INK if active else '#dedfd7')
            d.text((x+18,910),chdef['label'],font=font(23,True),fill=PAPER if active else MUTED)
            if active:d.rounded_rectangle((x,972,x+max(3,round(226*frame['progress'])),975),radius=2,fill=INK)
        process.stdin.write(image.tobytes())
        if n%180==90:
            image.save(out/f'preview-{chapter+1}.png')
            contact.append(image.resize((540,540),Image.Resampling.LANCZOS))
        if n%180==0:print(f'Rendering {name}',flush=True)
finally:
    process.stdin.close()
if process.wait()!=0:raise RuntimeError('ffmpeg failed')
sheet=Image.new('RGB',(1080,1080),PAPER)
for i,im in enumerate(contact):sheet.paste(im,((i%2)*540,(i//2)*540))
sheet.save(out/'contact-sheet.jpg',quality=92)
subprocess.run(['ffmpeg','-y','-v','error','-i',str(out/'motion-loops-reddit.mp4'),'-vf','fps=12,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0',str(out/'motion-loops-preview.gif')],check=True)
print(f'Saved MP4 and GIF to {out}',flush=True)
