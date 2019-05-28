const stage = document.getElementById('stage');
const regl = createREGL(stage);

const render = regl({
  vert: `
    precision mediump float;

    attribute vec2 position;

    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `,

  frag: `
    precision mediump float;

    uniform vec2 screenSize;
    uniform float seed;

    const float EXPOSURE = 1.0;
    const int MAX_MARCHING_STEPS = 100;
    const float MIN_DIST = 0.0;
    const float MAX_DIST = 100.0;
    const float EPSILON = 0.0001;
    const float WHITE = 200.0;
    const vec3 LIGHT = vec3(-10.0, 10.0, 3.0);
    const float STEP_SCALE = 0.67;

    float jitter(float mixAmount, float offset) {
      float amount = 0.0;
      float scale = 1.0;
      offset += seed;
      for (int power = 0; power < 3; power++) {
        amount += sin((offset * 1234.0 + mixAmount) * scale) / scale;
        scale *= 2.0;
      }

      amount *= 0.09;

      return amount;
    }

    vec3 warp(vec3 v, float scale) {
      return v + scale * vec3(jitter(v.x, 0.0), jitter(v.y, 0.2), jitter(v.z, 0.5));
    }

    float smoothUnion(float d1, float d2, float k) {
      float h = clamp(0.5 + 0.5*(d2-d1)/k, 0.0, 1.0);
      return mix(d2, d1, h) - k*h*(1.0-h);
    }

    float sphereSDF(vec3 samplePoint, vec3 origin, float radius) {
      return length(samplePoint - origin) - radius;
    }

    float sceneSDF(vec3 samplePoint) {
      vec3 warped = warp(samplePoint, 1.5);
      float d1 = sphereSDF(warped, vec3(0.5, 0.0, 0.0), 1.0);
      float d2 = sphereSDF(warped, vec3(-0.5, -0.4, 0.2), 0.5);
      float smoothed = smoothUnion(d1, d2, 0.4);

      float d3 = sphereSDF(warped, vec3(-0.8, 0.55, 0.2), 0.3);
      return min(smoothed, d3);
    }

    vec3 rayDirection(float fieldOfView, vec2 size, vec2 fragCoord) {
      vec2 xy = fragCoord - size / 2.0;
      float z = size.y / tan(radians(fieldOfView) / 2.0);
      return normalize(vec3(xy, -z));
    }

    float distance(vec3 eye, vec3 marchingDirection, float start, float end) {
      float depth = start;
      for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
        float dist = sceneSDF(eye + depth * marchingDirection);
        if (dist < EPSILON) {
          return depth;
        }
        depth += dist*STEP_SCALE;
        if (depth >= end) {
          return end;
        }
      }
      return end;
    }

    float shadow(vec3 origin, vec3 dir) {
      const float k = 2.0;
      float t = 100.0*EPSILON;
      float res = 1.0;
      for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
        float h = sceneSDF(origin + t * dir);
        if (h < EPSILON) {
          return 0.0;
        }
        t += h*STEP_SCALE;
        res = min(res, k*h/t);
      }
      return res;
    }

    vec3 render() {
      vec3 dir = rayDirection(45.0, screenSize, gl_FragCoord.xy);
      vec3 eye = vec3(0.0, 0.0, 8.0);
      float dist = distance(eye, dir, MIN_DIST, MAX_DIST);

      if (dist > MAX_DIST - EPSILON) {
        // Sky
        float d = dot(dir, normalize(vec3(0.0, -1.0, 0.0)));
        d *= 6.0;
        d = d/2.0 + 0.5;
        d = max(0.0, min(1.0, d));
        return mix(vec3(4.0, 40.0, 100.0), vec3(20.0, 100.0, 100.0), d);
      }
    
      // Shade cloud
      vec3 intersection = eye + dist * dir;
      vec3 toLight = normalize(LIGHT - intersection);
      const vec3 LIGHT = vec3(100.0, 100.0, 100.0);
      const vec3 DARK = vec3(5.0, 8.0, 20.0);
      return mix(DARK, LIGHT, shadow(intersection, toLight));
    }

    // John Hable's tone mapping function, to get each color channel into [0,1]
    float toneMap(float x) {
      float A = 0.15;
      float B = 0.50;
      float C = 0.10;
      float D = 0.20;
      float E = 0.02;
      float F = 0.30;
      return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
    }

    vec3 toneMapVec(vec3 v) {
      return vec3(toneMap(v.x), toneMap(v.y), toneMap(v.z));
    }

    void main() {
      vec3 color = render();

      float wScale = 1.0 / toneMap(EXPOSURE * WHITE);
      gl_FragColor = vec4(toneMapVec(EXPOSURE * color) * wScale, 1.0);
    }
  `,

  // Render a rectangle that covers the screen so that we can do calculations for each pixel
  attributes: {
    position: [
      -1.0, -1.0,
      1.0, -1.0,
      -1.0, 1.0,
      1.0, 1.0
    ],
  },
  count: 4,

  uniforms: {
    screenSize: ({framebufferWidth, framebufferHeight}) => [framebufferWidth, framebufferHeight],
    seed: regl.prop('seed'),
  },

  primitive: 'triangle strip',
});

let seed = 2.02;

onFrame = () => {
  render({ seed });
  seed += 0.000005;
  requestAnimationFrame(onFrame);
}

onFrame();
