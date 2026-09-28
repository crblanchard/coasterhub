# Draws skyline-day.svg / skyline-night.svg (the hero skyline):
#   python3 tools/make-skyline.py <outdir>
# An RMC-style hybrid (straight lift, beyond-vertical drop, big stall hill, dense
# wooden structure — Zadra / Steel Vengeance), a B&M hyper in side profile
# (Diamondback: straight lift, long steep drop, shrinking camelbacks on splayed
# tubular legs), an S&S triple tower, and a SkyScreamer. Carter, 2026-09-28.
import math, sys
W,H,G=620,200,198
def bez(p0,p1,p2,p3,n=48):
    return [tuple((1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d for a,b,c,d in zip(p0,p1,p2,p3)) for t in [i/n for i in range(n+1)]]
def track(segs):
    pts=[];d='M%.1f %.1f'%segs[0][0]
    for s in segs:
        if len(s)==2: pts+=[s[0],s[1]]; d+=' L%.1f %.1f'%s[1]
        else: pts+=bez(*s); d+=' C%.1f %.1f %.1f %.1f %.1f %.1f'%(s[1]+s[2]+s[3])
    return pts,d
def ymin(pts,x):
    best=None
    for (a,b),(c,e) in zip(pts,pts[1:]):
        if min(a,c)<=x<=max(a,c) and c!=a:
            y=b+(e-b)*(x-a)/(c-a); best=y if best is None else min(best,y)
    return best
def build(col,op,light=None):
    o=[]
    def S(d,w=1.2,a=None): o.append("<path d='%s' fill='none' stroke='%s' stroke-opacity='%.2f' stroke-width='%.1f' stroke-linecap='round' stroke-linejoin='round'/>"%(d,col,op if a is None else a,w))
    # ---- RMC hybrid: lift, crest, drop past vertical, stall hill, out
    rp,rd=track([((4,G),(92,30)),
                 ((92,30),(98,24),(108,22),(114,28)),
                 ((114,28),(124,40),(122,92),(114,130)),
                 ((114,130),(108,160),(118,G-10),(140,G-8)),
                 ((140,G-8),(158,G-6),(160,84),(186,84)),
                 ((186,84),(212,84),(212,G-8),(230,G-6)),
                 ((230,G-6),(238,G-4),(242,G),(248,G))])
    # dense wooden structure: bents and ledgers under the lift and the stall
    for x in range(8,236,5):
        y=ymin(rp,x)
        if y is None or y>G-4: continue
        S('M%d %.1f L%d %d'%(x,y+1.5,x,G),.55,op*.7)
    for yy in range(40,G,11):
        xs=[x for x in range(8,236,5) if (ymin(rp,x) or G)<yy-2]
        # contiguous runs only
        run=[]
        for x in xs+[None]:
            if run and (x is None or x-run[-1]>5):
                if len(run)>1: S('M%d %d L%d %d'%(run[0],yy,run[-1],yy),.45,op*.55)
                run=[]
            if x is not None: run.append(x)
    S(rd,1.9)
    # ---- B&M hyper: straight lift, rounded crest, long steep drop, camelbacks
    bp,bd=track([((244,G),(330,20)),
                 ((330,20),(336,12),(348,12),(354,22)),
                 ((354,22),(372,G-12)),
                 ((372,G-12),(378,G),(388,G),(394,G-16)),
                 ((394,G-16),(402,84),(416,72),(426,84)),
                 ((426,84),(434,96),(436,G-14),(446,G-14)),
                 ((446,G-14),(454,G-14),(456,118),(466,118)),
                 ((466,118),(476,118),(478,G-12),(488,G-10)),
                 ((488,G-10),(494,G-8),(500,G),(506,G))])
    # splayed tubular legs, B&M style
    for x in list(range(262,332,16))+[344,360]+list(range(400,500,12)):
        y=ymin(bp,x)
        if y is None or y>G-8: continue
        spread=max(3,(G-y)*.06)
        S('M%d %.1f L%.1f %d M%d %.1f L%.1f %d'%(x,y+2,x-spread,G,x,y+2,x+spread,G),.8,op*.8)
    S(bd,2)
    # ---- S&S triple tower: three lattice masts, rings, a pointed cap and spire
    for tx in (520,528,536):
        S('M%d %d L%d 44 M%d %d L%d 44'%(tx-2.5,G,tx-2.5,tx+2.5,G,tx+2.5),.9)
        z='M%.1f %d'%(tx-2.5,G)
        y=G; flip=1
        while y>48:
            y-=6; z+=' L%.1f %d'%(tx+2.5*flip,y); flip*=-1
        S(z,.45,op*.6)
        S('M%d 52 L%d 52 L%d 58 L%d 58 Z'%(tx-4,tx+4,tx+4,tx-4),1.2)
    S('M514 44 L542 44 L542 40 L514 40 Z M514 40 L528 22 L542 40 M528 22 L528 6',1.1)
    # ---- SkyScreamer: tallest, star of arms, swings flung out
    sx=578
    S('M%d %d L%d 4'%(sx,G,sx),1.8)
    S('M%d 14 L%d 14'%(sx-14,sx+14),1.5)
    for dx,ex,ey in [(-14,-30,42),(-8,-22,44),(8,22,44),(14,30,42)]:
        S('M%d 14 L%d %d'%(sx+dx,sx+ex,ey),.7,op*.85)
        S('M%d %d L%d %d'%(sx+ex-2,ey,sx+ex+2,ey),1.8)
    if light:
        L=lambda d,gap=9: o.append("<path d='%s' fill='none' stroke='%s' stroke-width='2.4' stroke-dasharray='0.1 %d' stroke-linecap='round'/>"%(d,light,gap))
        L(rd); L(bd)
        L('M514 40 L528 22 L542 40',5)
        L('M%d 14 L%d 14'%(sx-14,sx+14),5)
        for cx,cy in [(528,5),(sx,3)]:
            o.append("<circle cx='%d' cy='%d' r='2.2' fill='#ff5a5f'/>"%(cx,cy))
    return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 %d %d'>%s</svg>"%(W,H,''.join(o))
out=sys.argv[1] if len(sys.argv)>1 else '.'
open(out+'/skyline-day.svg','w').write(build('#0a6aa0',.5))
open(out+'/skyline-night.svg','w').write(build('#ffffff',.32,'#ffcc1f'))
