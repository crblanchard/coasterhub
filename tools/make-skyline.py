# Draws skyline-day.svg / skyline-night.svg (the hero skyline):
#   python3 tools/make-skyline.py <outdir>
# Left to right (Carter's references, 2026-09-28):
#   - a wooden coaster with Texas Giant's lift and drop: a long straight lift at
#     about 35 degrees, a tight rounded crest, a curved drop near 70 degrees, all
#     on a gridded wooden structure (bents, ledgers, cross-braces);
#   - a B&M hyper drawn from Shambhala: lift, crest, drop, then three parabolic
#     hills each lower than the last, on white tubular columns;
#   - Cedar Point's Giant Wheel, Power Tower (masts under a rounded crown), Wicked Twister
#     (two twisted spikes on lattice supports, the U of track between them) and
#     WindSeeker (the tallest: a pole with a flared canopy, swings flung out).
# Heights are roughly to scale with each other. A low treeline hides where the
# tracks run off. The lift starts at the far left and low down, so the upper
# left of the picture stays empty for the page title.
import math, sys
W,H,G=868,200,198

def bez(p0,p1,p2,p3,n=40):
    return [tuple((1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d for a,b,c,d in zip(p0,p1,p2,p3))
            for t in [i/n for i in range(n+1)]]

def spline(knots):
    """Knots are (x, y, heading in degrees, up positive). Each span is a cubic whose
    handles run along the headings, so the track has no kinks."""
    pts=[];d='M%.1f %.1f'%knots[0][:2]
    for (x0,y0,a0),(x1,y1,a1) in zip(knots,knots[1:]):
        L=math.hypot(x1-x0,y1-y0)/3
        c0=(x0+L*math.cos(math.radians(a0)),y0-L*math.sin(math.radians(a0)))
        c1=(x1-L*math.cos(math.radians(a1)),y1+L*math.sin(math.radians(a1)))
        pts+=bez((x0,y0),c0,c1,(x1,y1))
        d+=' C%.1f %.1f %.1f %.1f %.1f %.1f'%(c0+c1+(x1,y1))
    return pts,d

def ytop(pts,x):
    """The highest point of the track above x (None if the track is not there)."""
    best=None
    for (a,b),(c,e) in zip(pts,pts[1:]):
        if min(a,c)<=x<=max(a,c) and c!=a:
            y=b+(e-b)*(x-a)/(c-a); best=y if best is None else min(best,y)
    return best

def build(col,op,light=None,trees=None):
    o=[]; groups={}
    def S(d,w=1.0,a=1.0):
        # strokes of the same weight share one <path>, which keeps the file small
        k=(w,a)
        if k not in groups: groups[k]=[]; o.append(k)
        groups[k].append(d)
    lights=[]
    def L(d,gap=8,w=2.2):
        lights.append("<path d='%s' fill='none' stroke='%s' stroke-width='%.1f' stroke-dasharray='0.1 %g' "
                      "stroke-linecap='round'/>"%(d,light,w,gap))
    beacons=[]

    # Both coasters are height functions of x: a straight lift laid tangent onto a
    # cos^2 bump, whose far side is the drop, then more bumps for hills. cos^2 has
    # a parabolic top and flattens at its feet, which is how a real hill and a
    # pullout look, and nothing overshoots the way hand-set curve handles did.
    def bump(x,c,h,hw):
        u=(x-c)/hw
        return h*math.cos(math.pi/2*u)**2 if abs(u)<1 else 0
    def lift_onto(c,h,hw,deg):
        """Where a lift at deg meets the bump centred at c tangentially, and where
        it leaves the ground."""
        k=math.pi/(2*hw); m=math.tan(math.radians(deg))
        dx=math.asin(min(1,m/(h*k)))/(2*k); xt=c-dx; ht=bump(xt,c,h,hw)
        return xt,ht,xt-ht/m,m
    def profile(x0,x1,f,base,sig):
        """Samples f, then blurs it with a Gaussian whose width sig(x) varies, so a
        crest can be rounded more than the hills, and the ends sink into the trees."""
        xs=[x0-30+i*.5 for i in range(int((x1-x0+60)*2)+1)]
        raw=[f(x) for x in xs]
        pts=[]
        for i,x in enumerate(xs):
            if not x0<=x<=x1: continue
            sg=sig(x); n=int(sg*2.5/.5); acc=wt=0
            for j in range(max(0,i-n),min(len(xs),i+n+1)):
                w=math.exp(-((xs[j]-x)/sg)**2/2); acc+=w*raw[j]; wt+=w
            pts.append((x,base-acc/wt))
        return pts,'M'+' L'.join('%.1f %.1f'%p for p in pts[::4]+[pts[-1]])
    def sink(x,a,b):
        """Drops the track below the treeline before x=a and after x=b."""
        return -max(0,a-x)*.5-max(0,x-b)*.5

    # ---------- wooden coaster (Texas Giant's angles) ----------
    wc,wh,ww=168,116,44
    wxt,wht,wx0,wm=lift_onto(wc,wh,ww,35)
    wf=lambda x: ((x-wx0)*wm if x<wxt else bump(x,wc,wh,ww))+sink(x,-99,wc+ww+2)
    wp,wd=profile(max(-4,wx0),wc+ww+22,wf,G-4,lambda x:2.5+4*math.exp(-((x-wc)/14)**2))
    posts=list(range(2,wc+ww-4,7))
    tops={x:ytop(wp,x) for x in posts}
    # bents: straight posts from the ground to the track
    for x in posts:
        y=tops[x]
        if y is not None and y<G-5: S('M%d %.1f L%d %d'%(x,y+1.4,x,G),.55,.75)
    # ledgers every 13 units, run between neighbouring posts that reach them
    levels=list(range(G-13,G-120,-13))
    for yy in levels:
        run=[x for x in posts if tops[x] is not None and tops[x]<yy-1.5]
        seg=[]
        for x in run+[None]:
            if seg and (x is None or x-seg[-1]>7):
                if len(seg)>1: S('M%d %d L%d %d'%(seg[0],yy,seg[-1],yy),.45,.6)
                seg=[]
            if x is not None: seg.append(x)
    # one diagonal per bay, alternating, where the bay is closed on all sides
    for i,(x0,x1) in enumerate(zip(posts,posts[1:])):
        for j,(yb,yt) in enumerate(zip([G]+levels,levels)):
            if tops[x0] is None or tops[x1] is None or max(tops[x0],tops[x1])>yt-1.5: continue
            if (i+j)%2: S('M%d %d L%d %d'%(x0,yb,x1,yt),.35,.45)
            else: S('M%d %d L%d %d'%(x0,yt,x1,yb),.35,.45)
    S(wd,2.0)
    if light: L(wd)

    # ---------- B&M hyper, Shambhala's profile ----------
    # first drop, then three hills, each lower and narrower than the one before
    hills=[(352,186,62),(462,134,44),(550,100,38),(624,72,32)]
    hxt,hht,hx0,hm=lift_onto(*hills[0],40)
    hf=lambda x: ((x-hx0)*hm if x<hxt else sum(bump(x,*b) for b in hills))+sink(x,hx0+6,676)
    hp,hd=profile(hx0-8,700,hf,G-6,lambda x:2.5+8*math.exp(-((x-hills[0][0])/18)**2))
    def column(x,spread=0):
        y=ytop(hp,x)
        if y is None or y>G-8: return
        if spread: S('M%.1f %.1f L%.1f %d M%.1f %.1f L%.1f %d'%(x,y+2,x-spread,G,x,y+2,x+spread,G),.8,.85)
        else: S('M%.1f %.1f L%.1f %d'%(x,y+2,x,G),.9,.85)
    for x in range(int(hx0)+22,int(hxt)-4,17): column(x)
    for f in (-9,9): column(hills[0][0]+f)
    for c,h,hw in hills[1:]:
        for f in (-.45,0,.45): column(c+f*hw)
    S(hd,2.4)
    if light: L(hd); beacons.append((hills[0][0],ytop(hp,hills[0][0])-5))

    # ---------- Ferris wheel (Cedar Point's Giant Wheel, set back a little) ----------
    fx,fr=689,34; fy=G-10-fr
    S('M%d %d L%d %d L%d %d'%(fx-17,G,fx,fy,fx+17,G),1.0)          # A-frame legs
    S('M%.1f %.1f A%d %d 0 1 0 %.1f %.1f A%d %d 0 1 0 %.1f %.1f'%(fx-fr,fy,fr,fr,fx+fr,fy,fr,fr,fx-fr,fy),1.3)
    S('M%.1f %.1f A%d %d 0 1 0 %.1f %.1f A%d %d 0 1 0 %.1f %.1f'%(fx-fr*.8,fy,fr*.8,fr*.8,fx+fr*.8,fy,fr*.8,fr*.8,fx-fr*.8,fy),.5,.6)
    spokes=[]; cars=[]
    for i in range(16):
        a=2*math.pi*i/16
        rx,ry=fx+fr*math.cos(a),fy+fr*math.sin(a)
        spokes.append('M%d %d L%.1f %.1f'%(fx,fy,rx,ry))
        cars.append('M%.1f %.1f h3 v3.2 h-3 Z'%(rx-1.5,ry+.8))   # gondolas hang below the rim
    S(' '.join(spokes),.4,.6)
    S(' '.join(cars),.8)
    S('M%.1f %.1f A2 2 0 1 0 %.1f %.1f A2 2 0 1 0 %.1f %.1f'%(fx-2,fy,fx+2,fy,fx-2,fy),1.0)
    if light:
        L('M%.1f %.1f A%d %d 0 1 0 %.1f %.1f A%d %d 0 1 0 %.1f %.1f'%(fx-fr,fy,fr,fr,fx+fr,fy,fr,fr,fx-fr,fy),5,2)
        for i in range(0,16,2):
            a=2*math.pi*i/16
            L('M%d %d L%.1f %.1f'%(fx,fy,fx+fr*math.cos(a),fy+fr*math.sin(a)),6,1.6)

    # ---------- Power Tower ----------
    px,pt=742,G-172          # centre, top of the masts
    for mx in (px-7,px+7):
        S('M%.1f %d L%.1f %d M%.1f %d L%.1f %d'%(mx-2.5,G,mx-2.5,pt,mx+2.5,G,mx+2.5,pt),.8)
        z='M%.1f %d'%(mx-2.5,G); y=G; f=1
        while y>pt+5:
            y-=5; z+=' L%.1f %d'%(mx+2.5*f,y); f=-f
        S(z,.4,.55)
    # seats: one ring parked low, one shot to the top
    S('M%.1f %d h9 v5 h-9 Z'%(px-11.5,G-40),1.1)
    S('M%.1f %d h9 v5 h-9 Z'%(px+2.5,pt+8),1.1)
    # the crown: a band across the masts and a rounded top with ribs
    S('M%d %d L%d %d'%(px-11,pt,px+11,pt),1.2)
    S('M%d %d C%d %d %d %d %d %d C%d %d %d %d %d %d'%(px-11,pt,px-11,pt-10,px-5,pt-14,px,pt-14,px+5,pt-14,px+11,pt-10,px+11,pt),1.2)
    S('M%d %d L%d %d M%d %d L%d %d M%d %d L%d %d'%(px-5,pt,px-5,pt-11,px,pt,px,pt-14,px+5,pt,px+5,pt-11),.5,.7)
    if light:
        L('M%d %d C%d %d %d %d %d %d C%d %d %d %d %d %d'%(px-11,pt,px-11,pt-10,px-5,pt-14,px,pt-14,px+5,pt-14,px+11,pt-10,px+11,pt),4.5,2)
        beacons.append((px,pt-16))

    # ---------- Wicked Twister ----------
    def spike(sx,top,lean):
        # lattice support standing beside the spike, up to about two thirds
        st=G-int((G-top)*.62); bx=sx-lean*9
        S('M%.1f %d L%.1f %d M%.1f %d L%.1f %d'%(bx-2,G,bx-2,st,bx+2,G,bx+2,st),.7,.8)
        z='M%.1f %d'%(bx-2,G); y=G; f=1
        while y>st+4:
            y-=5; z+=' L%.1f %d'%(bx+2*f,y); f=-f
        S(z,.35,.5)
        S('M%.1f %d L%.1f %d'%(bx,st+4,sx,st+4),.7,.8)
        # the track: a flat ribbon turning over as it climbs (it is twice as wide
        # face-on as it is edge-on), the tip curling outwards
        lft=[];rgt=[]
        for i in range(81):
            t=i/80; y=G-14-(G-14-top)*t
            x=sx+lean*5*t**3
            hw=.5+2.1*abs(math.cos(t*2.5*math.pi))*(1-t*.35)
            lft.append('%.1f %.1f'%(x-hw,y)); rgt.append('%.1f %.1f'%(x+hw,y))
        o.append("<path d='M%s L%s Z' fill='%s' fill-opacity='%.2f' stroke='%s' stroke-opacity='%.2f' stroke-width='.5'/>"
                 %(' L'.join(lft),' L'.join(reversed(rgt)),col,op*.55,col,op))
        return sx+lean*5
    tl,tr=776,812
    a=spike(tl,G-150,-1); b=spike(tr,G-150,1)
    # the U between them: low launch track and station
    u='M%d %d C%d %d %d %d %d %d L%d %d C%d %d %d %d %d %d'%(tl,G-14,tl,G-5,tl+4,G-4,tl+10,G-4,tr-10,G-4,tr-4,G-4,tr,G-5,tr,G-14)
    S(u,1.2)
    if light:
        L('M%d %d L%d %d'%(tl,G-14,tl,G-148),7,2); L('M%d %d L%d %d'%(tr,G-14,tr,G-148),7,2)
        beacons+= [(a,G-152),(b,G-152)]

    # ---------- WindSeeker ----------
    wx=840
    S('M%d %d L%d %d'%(wx-1.2,G,wx-1.2,14),.8); S('M%d %d L%d %d'%(wx+1.2,G,wx+1.2,14),.8)
    S('M%d 14 L%d 8 L%d 14 Z'%(wx-3,wx,wx+3),.9)
    cy=26   # the carriage, near the top, flung swings below it
    S('M%d %d C%d %d %d %d %d %d C%d %d %d %d %d %d'%(wx-16,cy+6,wx-10,cy+1,wx-5,cy-2,wx,cy-2,wx+5,cy-2,wx+10,cy+1,wx+16,cy+6),1.3)
    S('M%d %d L%d %d'%(wx-16,cy+6,wx+16,cy+6),.7,.8)
    for dx in (-16,-11,-6,6,11,16):
        s=1 if dx>0 else -1
        ex=wx+dx+s*9; ey=cy+6+15
        S('M%d %d L%d %d'%(wx+dx,cy+6,ex,ey),.45,.75)
        S('M%.1f %d L%.1f %d'%(ex-1.6,ey,ex+1.6,ey),1.6)
    if light:
        L('M%d %d L%d %d'%(wx-16,cy+6,wx+16,cy+6),4,2)
        beacons.append((wx,6))

    # ---------- treeline along the floor ----------
    t=[]
    x=-4; k=0
    while x<W+8:
        r=2.6+((k*37)%7)*.45; k+=1
        if True:
            t.append("<circle cx='%.1f' cy='%.1f' r='%.1f'/>"%(x,G+2-r*.35,r))
        x+=r*1.1
    tree="<g fill='%s' fill-opacity='%.2f'>%s</g>"%(trees[0],trees[1],''.join(t)) if trees else ''

    beac=''.join("<circle cx='%.1f' cy='%.1f' r='1.9' fill='#ff5a5f'/>"%b for b in beacons) if light else ''
    o=[x if isinstance(x,str) else
       "<path d='%s' fill='none' stroke='%s' stroke-opacity='%.2f' stroke-width='%.2f' stroke-linecap='round' stroke-linejoin='round'/>"
       %(' '.join(groups[x]),col,op*x[1],x[0]) for x in o]
    return ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 %d %d'>%s%s%s%s</svg>"
            %(W,H,''.join(o),''.join(lights),beac,tree))

out=sys.argv[1] if len(sys.argv)>1 else '.'
open(out+'/skyline-day.svg','w').write(build('#0a6aa0',.55,trees=('#0a6aa0',.16)))
open(out+'/skyline-night.svg','w').write(build('#ffffff',.36,'#ffcc1f',trees=('#000000',.45)))
