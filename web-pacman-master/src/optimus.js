//////////////////////////////////////////////////////////////////////////////////////
// Optimus Prime
// Shows the animated glTF model (see optimusModel.js) in the free space to the right of
// the home menu.  It is a separate, non-interactive WebGL canvas floating over the page,
// so it never touches the game canvas or its input.  The model is drawn exactly as it
// is stored: vertex colors as-is, its own waving animation, no changes to its data.

var optimus = (function() {

    var ASPECT = 0.8;          // width / height of the model's box
    var MIN_SEGMENT = 150;     // css pixels; the model stays hidden when the right segment is narrower
    var wanted = false;        // true while the home menu is the current screen
    var cv = null, gl = null, model = null, failed = false;
    var raf = 0, t = 0, last = 0, boxW = 0, boxH = 0;
    var showing = false;

    ////////////////////////////////////////////////////////////////////////////////
    // glTF binary loading

    var b2b = function(s) {
        var r = atob(s), u = new Uint8Array(r.length), i;
        for (i=0; i<r.length; i++) u[i] = r.charCodeAt(i);
        return u.buffer;
    };

    var parse = function() {
        var buf = b2b(OPTIMUS_GLB_B64);
        var dv = new DataView(buf);
        var jl = dv.getUint32(12, true);
        var G = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
        var bo = 20 + jl + 8;
        var acc = function(i) {
            var a = G.accessors[i], v = G.bufferViews[a.bufferView];
            var n = {SCALAR:1, VEC2:2, VEC3:3, VEC4:4}[a.type];
            var o = bo + (v.byteOffset||0) + (a.byteOffset||0), c = a.count*n, k, f, u;
            switch (a.componentType) {
                case 5126: return new Float32Array(buf.slice(o, o+c*4));
                case 5125: return new Uint32Array(buf.slice(o, o+c*4));
                case 5123: return new Uint16Array(buf.slice(o, o+c*2));
                case 5121:
                    u = new Uint8Array(buf, o, c); f = new Float32Array(c);
                    for (k=0; k<c; k++) f[k] = u[k]/255;
                    return f;
                case 5120:
                    u = new Int8Array(buf, o, c); f = new Float32Array(c);
                    for (k=0; k<c; k++) f[k] = Math.max(-1, u[k]/127);
                    return f;
            }
        };
        return {G:G, acc:acc};
    };

    ////////////////////////////////////////////////////////////////////////////////
    // WebGL setup

    var compile = function(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
    };

    var setup = function() {
        cv = document.createElement("canvas");
        cv.id = "optimus-model";
        cv.style.cssText = "position:fixed;display:none;pointer-events:none;background:#000;z-index:5;";
        document.body.appendChild(cv);
        gl = cv.getContext("webgl2", {antialias:true});
        if (!gl) { failed = true; return; }

        var prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER,
            "#version 300 es\n" +
            "in vec3 p;in vec3 n;in vec4 c;uniform mat4 mvp;uniform mat3 nm;out vec3 vn;out vec3 vc;\n" +
            "void main(){vn=nm*n;vc=c.rgb;gl_Position=mvp*vec4(p,1.0);}"));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER,
            "#version 300 es\n" +
            "precision mediump float;in vec3 vn;in vec3 vc;out vec4 o;\n" +
            "void main(){vec3 N=normalize(vn);" +
            "float d=max(dot(N,normalize(vec3(0.3,0.5,0.8))),0.0);" +
            "float f=max(dot(N,normalize(vec3(-0.5,0.2,-0.6))),0.0);" +
            "o=vec4(vc*(0.58+0.42*d+0.08*f),1.0);}"));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);

        var L = {
            p: gl.getAttribLocation(prog, "p"),
            n: gl.getAttribLocation(prog, "n"),
            c: gl.getAttribLocation(prog, "c"),
            mvp: gl.getUniformLocation(prog, "mvp"),
            nm: gl.getUniformLocation(prog, "nm")
        };
        var mk = function(arr, target) {
            var b = gl.createBuffer();
            gl.bindBuffer(target, b);
            gl.bufferData(target, arr, gl.STATIC_DRAW);
        };

        var g = parse(), G = g.G, acc = g.acc;
        var meshes = G.meshes.map(function(m) {
            var pr = m.primitives[0], at = pr.attributes, idx = acc(pr.indices), vao = gl.createVertexArray();
            gl.bindVertexArray(vao);
            [[L.p, at.POSITION, 3], [L.n, at.NORMAL, 3], [L.c, at.COLOR_0, 4]].forEach(function(e) {
                mk(acc(e[1]), gl.ARRAY_BUFFER);
                gl.enableVertexAttribArray(e[0]);
                gl.vertexAttribPointer(e[0], e[2], gl.FLOAT, false, 0, 0);
            });
            mk(idx, gl.ELEMENT_ARRAY_BUFFER);
            return {vao:vao, count:idx.length, type: (idx instanceof Uint16Array) ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT};
        });

        var an = G.animations[0], ch = an.channels[0], smp = an.samplers[ch.sampler];
        var kt = acc(smp.input), kq = acc(smp.output);
        model = {G:G, L:L, meshes:meshes, kt:kt, kq:kq, dur:kt[kt.length-1], animNode:ch.target.node};
    };

    ////////////////////////////////////////////////////////////////////////////////
    // math (column-major 4x4)

    var mul = function(a, b) {
        var o = new Array(16), c, r, k, s;
        for (c=0; c<4; c++) for (r=0; r<4; r++) {
            s = 0;
            for (k=0; k<4; k++) s += a[k*4+r]*b[c*4+k];
            o[c*4+r] = s;
        }
        return o;
    };
    var persp = function(fov, asp, n, f) {
        var t = 1/Math.tan(fov/2);
        return [t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,2*f*n/(n-f),0];
    };
    var lookAt = function(e, c, u) {
        var norm = function(a){ var l = Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]); return [a[0]/l,a[1]/l,a[2]/l]; };
        var cross = function(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; };
        var dot = function(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; };
        var z = norm([e[0]-c[0], e[1]-c[1], e[2]-c[2]]), x = norm(cross(u,z)), y = cross(z,x);
        return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1];
    };

    var quatAt = function(time) {
        var kt = model.kt, kq = model.kq, k = 0, i, q = [], l;
        while (k < kt.length-2 && time >= kt[k+1]) k++;
        var f = (time-kt[k])/(kt[k+1]-kt[k]);
        for (i=0; i<4; i++) q.push(kq[k*4+i]*(1-f) + kq[(k+1)*4+i]*f);
        l = Math.sqrt(q[0]*q[0]+q[1]*q[1]+q[2]*q[2]+q[3]*q[3]);
        return [q[0]/l, q[1]/l, q[2]/l, q[3]/l];
    };

    var nodeMatrix = function(n, time, i) {
        var T = n.translation || [0,0,0], q = n.rotation || [0,0,0,1];
        if (i === model.animNode) q = quatAt(time);
        var x = q[0], y = q[1], z = q[2], w = q[3];
        return [1-2*(y*y+z*z), 2*(x*y+z*w), 2*(x*z-y*w), 0,
                2*(x*y-z*w), 1-2*(x*x+z*z), 2*(y*z+x*w), 0,
                2*(x*z+y*w), 2*(y*z-x*w), 1-2*(x*x+y*y), 0,
                T[0], T[1], T[2], 1];
    };

    ////////////////////////////////////////////////////////////////////////////////
    // drawing

    var FOV = 0.52;
    var TARGET = [-0.05, 0.9, 0];
    var NEED_H = 1.8, NEED_W = 1.3; // world size of the model incl. its text, with a little margin

    var draw = function() {
        var w = cv.width, h = cv.height, asp = w/h, th = Math.tan(FOV/2);
        var dist = Math.max(NEED_H/2/th, NEED_W/2/(asp*th));
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        var eye = [TARGET[0], TARGET[1] + dist*Math.sin(0.05), TARGET[2] + dist*Math.cos(0.05)];
        var vp = mul(persp(FOV, asp, 0.1, 30), lookAt(eye, TARGET, [0,1,0]));
        model.G.nodes.forEach(function(n, i) {
            if (n.mesh === undefined) return;
            var M = nodeMatrix(n, t, i), m = model.meshes[n.mesh];
            gl.uniformMatrix4fv(model.L.mvp, false, new Float32Array(mul(vp, M)));
            gl.uniformMatrix3fv(model.L.nm, false, new Float32Array([M[0],M[1],M[2], M[4],M[5],M[6], M[8],M[9],M[10]]));
            gl.bindVertexArray(m.vao);
            gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
        });
    };

    var tick = function(now) {
        raf = 0;
        if (!showing) return;
        var dt = Math.min((now-last)/1000, 0.1);
        last = now;
        t = (t + dt) % model.dur;
        draw();
        raf = requestAnimationFrame(tick);
    };

    var start = function() {
        if (raf || !showing) return;
        last = performance.now();
        raf = requestAnimationFrame(tick);
    };

    ////////////////////////////////////////////////////////////////////////////////

    var hideBox = function() {
        showing = false;
        if (cv) cv.style.display = "none";
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    return {
        // true while the home menu is on screen (the page then centers the menu in the window)
        isWanted: function() { return wanted; },

        show: function() {
            wanted = true;
            if (typeof document == "undefined") return;
            if (!cv && !failed) {
                try { setup(); } catch (e) { failed = true; if (window.console) console.warn("optimus: " + e.message); }
            }
        },

        hide: function() {
            wanted = false;
            hideBox();
        },

        // place the model in the middle of the free space right of the game canvas
        layout: function() {
            if (!wanted || failed || !cv) { hideBox(); return; }
            var gc = document.getElementById("canvas");
            var r = gc.getBoundingClientRect();
            // right edge of the menu buttons (the canvas itself has some empty margin beyond them)
            var menuRight = (r.left + r.right)/2 + (mapWidth - 4*tileSize)/2 * (r.width/screenWidth);
            var segW = window.innerWidth - menuRight;
            if (segW < MIN_SEGMENT) { hideBox(); return; }
            var h = Math.min(window.innerHeight*0.8, (segW-24)/ASPECT);
            var w = h*ASPECT;
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            cv.style.left = Math.round(menuRight + (segW-w)/2) + "px";
            cv.style.top = Math.round((window.innerHeight-h)/2) + "px";
            cv.style.width = Math.round(w) + "px";
            cv.style.height = Math.round(h) + "px";
            cv.width = Math.round(w*dpr);
            cv.height = Math.round(h*dpr);
            cv.style.display = "block";
            showing = true;
            draw();
            start();
        }
    };

})();
