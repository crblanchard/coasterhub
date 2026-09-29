# Draws skyline-day.svg / skyline-night.svg (the hero skyline):
#   python3 tools/make-skyline.py <outdir>
# Carter, 2026-09-29: "just do this from a side view (basically this photo
# exactly) with the Ferris wheel then drop tower/swings to the right" — the photo
# is Magnum XL-200 at sunset. So, left to right:
#   - the coaster: a straight lift at 33 degrees laid tangent onto a parabola
#     for the crest; the drop is full steepness (about 66 degrees) a quarter of
#     the way down, straight, then a pullout over the bottom third, with
#     a railed platform and a mast on top and a train just over the crest. It
#     stands on seven steel box towers (columns, ledgers, an X in every panel)
#     with open sky between them, measured off the photo;
#   - a Ferris wheel, Power Tower (masts under a rounded crown, solid cars), and
#     WindSeeker (a thick solid tower with a flared canopy, swings flung out).
# The band colours are passed in (bg) so solid parts can be one opaque colour.
# A treeline, rising into a hill under the drop as in the photo, hides the feet.
# The lift starts at the far left and low down, so the upper left of the picture
# stays empty for the page title.
# (The busier version with a wooden coaster, a Shambhala hyper and Wicked Twister
# is in git history, commit 5554345.)
import math, sys
W,H,G=650,200,198

# The coaster, in picture units. The photo was measured in its own pixels and
# scaled by S_ so the crest sits 182 units above the ground.
S_=0.298
def px(x): return 4+(x-215)*S_
VX,VY=px(1215),G-182          # top of the parabola
A=0.00205/S_                  # its curvature (photo: 0.00205 per pixel)
M=0.65                        # lift slope, about 33 degrees
TX=VX-M/(2*A); TY=VY+A*(TX-VX)**2   # where the lift meets the parabola, tangent
# The drop (Carter, 2026-09-29): it reaches its full steepness a quarter of the
# way down, runs straight, and the bottom third is the pullout, nearly flat by the
# time it reaches the Ferris wheel. Built from its slope, span by span, so every
# join is smooth:
MD=2.21                       # steepest, about 66 degrees
HT=G-VY                       # the coaster's height
def _ease_in(A,m,D):
    """Slope from 0 up to m with the crest's curvature at the start and none at the
    end, losing height D: returns the span's length and its slope as a function."""
    Lh=(-m/2+math.sqrt(m*m/4+4*(A/6)*D))/(2*A/6)
    a=2*A*Lh/m; b=3-2*a; c=a-2
    return Lh,lambda u: m*(a*u+b*u*u+c*u**3)
L1,s1=_ease_in(A,MD,HT/4)
L2=(HT*(1-1/4-1/3))/MD                      # the straight part
SE=.07                                       # the pullout's last, shallow slope
L3=2*(HT/3-8)/(MD+SE)                        # the pullout, ending 8 above the floor
X1,X2,X3=VX+L1,VX+L1+L2,VX+L1+L2+L3
X4=X3+26                                     # the run out towards the wheel
def _slope(x):
    if x<X1: return s1((x-VX)/L1)
    if x<X2: return MD
    if x<X3:
        u=(x-X2)/L3; return MD-(MD-SE)*(3*u*u-2*u**3)
    return SE+max(0,x-X4)*.05                # and into the trees
_dx=.1; _drop=[VY]
for i in range(1,int((X4+20-VX)/_dx)+2):
    x=VX+(i-.5)*_dx; _drop.append(_drop[-1]+_slope(x)*_dx)
def track_y(x):
    if x<TX: return TY+(TX-x)*M
    if x<VX: return VY+A*(x-VX)**2
    i=min(len(_drop)-1,int((x-VX)/_dx)); return _drop[i]
X_END=X4+20

def build(col,op,light=None,trees=None,bg=None):
    o=[]; groups={}
    # the line colour at its opacity, laid over the band, as one opaque colour:
    # what a filled part is painted with, so it hides whatever is behind it
    h=lambda c:[int(c[i:i+2],16) for i in (1,3,5)]
    solid='#%02x%02x%02x'%tuple(round(b+(f-b)*op) for f,b in zip(h(col),h(bg)))
    def F(d):
        # a filled, opaque part, painted now, over everything drawn before it
        o.append("<path d='%s' fill='%s' stroke='%s' stroke-width='.6' stroke-linejoin='round'/>"%(d,solid,solid))
    def P(d,w=1.0,a=1.0):
        # a line painted now, rather than with its weight group
        o.append("<path d='%s' fill='none' stroke='%s' stroke-opacity='%.2f' stroke-width='%.2f' stroke-linecap='round' stroke-linejoin='round'/>"%(d,col,op*a,w))
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
    circ=lambda cx,cy,r: 'M%.1f %.1f A%.1f %.1f 0 1 0 %.1f %.1f A%.1f %.1f 0 1 0 %.1f %.1f'%(cx-r,cy,r,r,cx+r,cy,r,r,cx-r,cy)

    # ---------- the coaster ----------
    xs=[-2+i*1.0 for i in range(int(X_END+2)+1)]
    pts=[(x,track_y(x)) for x in xs]
    d='M'+' L'.join('%.1f %.1f'%p for p in pts)
    # the towers: columns (photo x positions), each tower its own group
    towers=[[px(x) for x in t] for t in
            [(300,340,385,425),(478,525,575,622),(670,718,768,815),(868,918,968,1015),(1090,1135,1195,1240,1300,1345)]]
    # down the drop and along the pullout the towers shorten with the track
    towers+=[[X1+12,X1+22,X1+32],[X2+9,X2+20,X2+31],[X3-3,X3+9]]
    levels=[G-12-34*k for k in range(6)]          # ledgers, every 34 units up
    for t in towers:
        cols=[(x,track_y(x)+1.6) for x in t]
        for x,top in cols: S('M%.1f %.1f L%.1f %d'%(x,top,x,G),.75)
        for (x0,t0),(x1,t1) in zip(cols,cols[1:]):
            below=[G]+[y for y in levels if y>max(t0,t1)+3]
            for yb,yt in zip(below,below[1:]):
                S('M%.1f %d L%.1f %d M%.1f %d L%.1f %d'%(x0,yb,x1,yt,x0,yt,x1,yb),.3,.55)
            # the panel under the track: braced up to the lower of the two columns
            yb=below[-1]; yt=max(t0,t1)
            if yb-yt>6: S('M%.1f %.1f L%.1f %.1f M%.1f %.1f L%.1f %.1f'%(x0,yb,x1,yt,x0,yt,x1,yb),.3,.55)
        for y in levels:
            run=[x for x,top in cols if top<y-1]
            if len(run)>1: S('M%.1f %d L%.1f %d'%(run[0],y,run[-1],y),.5,.7)
        # a cap beam under the track where the tower meets it, column to column
        S('M'+' L'.join('%.1f %.1f'%(x,top+.5) for x,top in cols),.6,.7)
    # the lift's walkway, a thin rail just under the chain
    S('M%.1f %.1f L%.1f %.1f'%(0,track_y(0)+2.6,TX-4,track_y(TX-4)+2.6),.5,.8)
    S(d,2.4)
    # the platform on top: a railing along the crest, and the mast
    p0,p1=px(1140),px(1255)
    rail='M%.1f %.1f'%(p0,track_y(p0)-3.5)
    for i in range(1,21):
        x=p0+(p1-p0)*i/20; rail+=' L%.1f %.1f'%(x,track_y(x)-3.5)
    posts=''.join(' M%.1f %.1f L%.1f %.1f'%(x,track_y(x)-1,x,track_y(x)-3.5) for x in [p0+(p1-p0)*i/8 for i in range(9)])
    S(rail+posts,.5,.8)
    mx=px(1195); S('M%.1f %.1f L%.1f %.1f'%(mx,track_y(mx)-1,mx,VY-10),.6)
    # the train, just over the crest: cars laid along the track, sitting on it
    s=px(1300); cars=[]
    for i in range(8):
        a=s; b=a
        while math.hypot(b-a,track_y(b)-track_y(a))<7.2: b+=.2
        ax,ay,bx,by=a,track_y(a),b,track_y(b)
        nx,ny=(by-ay),(ax-bx); n=math.hypot(nx,ny); nx,ny=nx/n*2.8,ny/n*2.8   # the upward normal
        cars.append('M%.1f %.1f L%.1f %.1f'%(ax+nx,ay+ny,bx+nx,by+ny))
        s=b
        while math.hypot(s-b,track_y(s)-track_y(b))<1.4: s+=.2
    o.append("<path d='%s' fill='none' stroke='%s' stroke-opacity='%.2f' stroke-width='3.4'/>"%(' '.join(cars),col,min(1,op*1.3)))
    if light:
        L(d,8); beacons.append((mx,VY-11))

    # ---------- Ferris wheel ----------
    fx,fr=504,42; fy=G-10-fr
    S('M%d %d L%d %d L%d %d'%(fx-20,G,fx,fy,fx+20,G),1.0)          # A-frame legs
    S(circ(fx,fy,fr),1.3)
    S(circ(fx,fy,fr*.8),.5,.6)
    spokes=[]; gond=[]
    for i in range(18):
        a=2*math.pi*i/18
        rx,ry=fx+fr*math.cos(a),fy+fr*math.sin(a)
        spokes.append('M%d %d L%.1f %.1f'%(fx,fy,rx,ry))
        gond.append('M%.1f %.1f h3.4 v3.6 h-3.4 Z'%(rx-1.7,ry+.8))   # gondolas hang below the rim
    S(' '.join(spokes),.4,.6)
    S(' '.join(gond),.8)
    S(circ(fx,fy,2.2),1.0)
    if light:
        L(circ(fx,fy,fr),5,2)
        for i in range(0,18,2):
            a=2*math.pi*i/18
            L('M%d %d L%.1f %.1f'%(fx,fy,fx+fr*math.cos(a),fy+fr*math.sin(a)),6,1.6)

    # ---------- Power Tower ----------
    pX,pt=571,G-172          # centre, top of the masts
    for mX in (pX-7,pX+7):
        S('M%.1f %d L%.1f %d M%.1f %d L%.1f %d'%(mX-2.5,G,mX-2.5,pt,mX+2.5,G,mX+2.5,pt),.8)
        z='M%.1f %d'%(mX-2.5,G); y=G; f=1
        while y>pt+5:
            y-=5; z+=' L%.1f %d'%(mX+2.5*f,y); f=-f
        S(z,.4,.55)
    # seats: one ring parked low, one shot to the top
    # opaque, so the masts do not show through them (Carter, 2026-09-29)
    F('M%.1f %d h9 v5 h-9 Z'%(pX-11.5,G-40))
    F('M%.1f %d h9 v5 h-9 Z'%(pX+2.5,pt+8))
    # the crown: a band across the masts and a rounded top with ribs
    crown='M%d %d C%d %d %d %d %d %d C%d %d %d %d %d %d'%(pX-11,pt,pX-11,pt-10,pX-5,pt-14,pX,pt-14,pX+5,pt-14,pX+11,pt-10,pX+11,pt)
    S('M%d %d L%d %d'%(pX-11,pt,pX+11,pt),1.2)
    S(crown,1.2)
    S('M%d %d L%d %d M%d %d L%d %d M%d %d L%d %d'%(pX-5,pt,pX-5,pt-11,pX,pt,pX,pt-14,pX+5,pt,pX+5,pt-11),.5,.7)
    if light:
        L(crown,4.5,2); beacons.append((pX,pt-16))

    # ---------- WindSeeker ----------
    wx=618
    # a thick tower, solid all the way through (Carter, 2026-09-29), tapering a
    # little, with a solid cap; the carriage and swings are painted over it
    F('M%.1f %d L%.1f 15 L%.1f 15 L%.1f %d Z'%(wx-3,G,wx-2.2,wx+2.2,wx+3,G))
    F('M%.1f 15 L%d 7 L%.1f 15 Z'%(wx-3.4,wx,wx+3.4))
    cy=26   # the carriage, near the top, flung swings below it
    P('M%d %d C%d %d %d %d %d %d C%d %d %d %d %d %d'%(wx-16,cy+6,wx-10,cy+1,wx-5,cy-2,wx,cy-2,wx+5,cy-2,wx+10,cy+1,wx+16,cy+6),1.3)
    P('M%d %d L%d %d'%(wx-16,cy+6,wx+16,cy+6),.7,.8)
    for dx in (-16,-11,-6,6,11,16):
        sg=1 if dx>0 else -1
        ex=wx+dx+sg*9; ey=cy+6+15
        P('M%d %d L%d %d'%(wx+dx,cy+6,ex,ey),.45,.75)
        P('M%.1f %d L%.1f %d'%(ex-1.6,ey,ex+1.6,ey),1.6)
    if light:
        L('M%d %d L%d %d'%(wx-16,cy+6,wx+16,cy+6),4,2); beacons.append((wx,6))

    # ---------- treeline: low along the floor, a low wooded rise under the drop ----------
    def env(x):
        return (5+9*math.exp(-((x-392)/30)**2)+5*math.exp(-((x-px(700))/60)**2)   # low enough to show the pullout
                +9*math.exp(-((x-(X4+14))/9)**2))                                   # a clump the run-out disappears into
    t=[]; x=-4; k=0
    while x<W+8:
        r=2.8+((k*37)%7)*.5; k+=1
        t.append("<circle cx='%.1f' cy='%.1f' r='%.1f'/>"%(x,G+2-env(x)+r,r))
        x+=r*1.05
    body='M-4 %d'%(H)+''.join(' L%.1f %.1f'%(x,G+3-env(x)+4) for x in range(-4,W+6,4))+' L%d %d Z'%(W+6,H)
    tree=("<g fill='%s' opacity='%.2f'><path d='%s'/>%s</g>"%(trees[0],trees[1],body,''.join(t))) if trees else ''

    beac=''.join("<circle cx='%.1f' cy='%.1f' r='1.9' fill='#ff5a5f'/>"%b for b in beacons) if light else ''
    o=[x if isinstance(x,str) else
       "<path d='%s' fill='none' stroke='%s' stroke-opacity='%.2f' stroke-width='%.2f' stroke-linecap='round' stroke-linejoin='round'/>"
       %(' '.join(groups[x]),col,op*x[1],x[0]) for x in o]
    return ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 %d %d'>%s%s%s%s</svg>"
            %(W,H,''.join(o),''.join(lights),beac,tree))

out=sys.argv[1] if len(sys.argv)>1 else '.'
open(out+'/skyline-day.svg','w').write(build('#0a6aa0',.55,trees=('#0a6aa0',.16),bg='#dcf0f4'))
open(out+'/skyline-night.svg','w').write(build('#ffffff',.36,'#ffcc1f',trees=('#000000',.45),bg='#060b15'))
