# Draws skyline-day.svg / skyline-night.svg (the hero skyline): python3 tools/make-skyline.py <outdir>
import math, sys
W,H,G=560,200,198
def bez(p0,p1,p2,p3,n=40):
    return [tuple((1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d for a,b,c,d in zip(p0,p1,p2,p3)) for t in [i/n for i in range(n+1)]]
def track(segs):
    pts=[];d='M%.1f %.1f'%segs[0][0]
    for s in segs:
        pts+=bez(*s); d+=' C%.1f %.1f %.1f %.1f %.1f %.1f'%(s[1]+s[2]+s[3])
    return pts,d
def yat(pts,x):
    best=None
    for (a,b),(c,e) in zip(pts,pts[1:]):
        if min(a,c)<=x<=max(a,c) and c!=a:
            y=b+(e-b)*(x-a)/(c-a); best=y if best is None else min(best,y)
    return best
def build(col,op,light=None):
    o=[]
    def S(d,w=1.2,a=None): o.append("<path d='%s' fill='none' stroke='%s' stroke-opacity='%.2f' stroke-width='%.1f' stroke-linecap='round' stroke-linejoin='round'/>"%(d,col,op if a is None else a,w))
    # --- big wooden coaster (left): lift, drop, turnaround hill, bunny hops
    wp,wd=track([((0,G),(20,G),(30,G-10),(40,G-22)),
                 ((40,G-22),(60,G-60),(70,80),(82,70)),
                 ((82,70),(92,62),(100,64),(108,78)),
                 ((108,78),(124,110),(128,G-16),(140,G-14)),
                 ((140,G-14),(152,G-12),(156,134),(168,132)),
                 ((168,132),(180,130),(184,G-14),(196,G-12)),
                 ((196,G-12),(204,G-10),(206,156),(214,156)),
                 ((214,156),(222,156),(224,G),(236,G))])
    x=6
    while x<234:
        y=yat(wp,x)
        if y is not None and y<G-3:
            S('M%.1f %.1f L%.1f %d'%(x,y+1.5,x,G),.6,op*.75)
            yy=y+6
            while yy<G-5:
                S('M%.1f %.1f L%.1f %.1f'%(x,yy,x+6,min(G,yy+7)),.45,op*.45); yy+=9
        x+=6
    S(wd,1.8)
    # --- B&M hyper (middle): tall lift, huge drop, camelback, low turn
    hp,hd=track([((230,G),(250,G),(256,G-14),(262,G-30)),
                 ((262,G-30),(284,120),(300,30),(314,22)),
                 ((314,22),(324,16),(334,18),(340,34)),
                 ((340,34),(352,70),(356,G-16),(372,G-18)),
                 ((372,G-18),(386,G-20),(386,90),(400,88)),
                 ((400,88),(414,86),(416,G-24),(432,G-10)),
                 ((432,G-10),(440,G-4),(446,G),(452,G))])
    for x in range(268,448,16):
        y=yat(hp,x)
        if y is not None and y<G-6: S('M%d %.1f L%d %d'%(x,y+2,x,G),.9,op*.85)
    S(hd,2)
    # --- drop tower
    tx=466
    S('M%d %d L%d 26 M%d %d L%d 26 M%d 26 L%d 26 M%d 26 L%d 14'%(tx-3,G,tx-3,tx+3,G,tx+3,tx-5,tx+5,tx,tx),1.4)
    S('M%d 54 L%d 54 L%d 64 L%d 64 Z'%(tx-9,tx+9,tx+9,tx-9),1.3)
    # --- SkyScreamer (right): tallest, arms at the top, swings flung out
    sx=524
    S('M%d %d L%d 4'%(sx,G,sx),1.8)
    S('M%d 12 L%d 12'%(sx-14,sx+14),1.5)
    for dx,ex,ey in [(-14,-30,40),(-8,-22,42),(8,22,42),(14,30,40)]:
        S('M%d 12 L%d %d'%(sx+dx,sx+ex,ey),.7,op*.85)
        S('M%d %d L%d %d'%(sx+ex-2,ey,sx+ex+2,ey),1.8)
    if light:
        L=lambda d: o.append("<path d='%s' fill='none' stroke='%s' stroke-width='2.4' stroke-dasharray='0.1 9' stroke-linecap='round'/>"%(d,light))
        L(wd); L(hd)
        for cx,cy in [(tx,13),(sx,3)]:
            o.append("<circle cx='%d' cy='%d' r='2.2' fill='#ff5a5f'/>"%(cx,cy))
        o.append("<path d='M%d 12 L%d 12' stroke='%s' stroke-width='2' stroke-dasharray='0.1 5' stroke-linecap='round'/>"%(sx-14,sx+14,light))
    return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 %d %d'>%s</svg>"%(W,H,''.join(o))
open(sys.argv[1]+'/sky_day.svg','w').write(build('#0a6aa0',.5))
open(sys.argv[1]+'/sky_night.svg','w').write(build('#ffffff',.32,'#ffcc1f'))
