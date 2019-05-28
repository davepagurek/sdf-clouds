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
    const int MAX_MARCHING_STEPS = 255;
    const float MIN_DIST = 0.0;
    const float MAX_DIST = 100.0;
    const float EPSILON = 0.0001;
    const float WHITE = 200.0;

    float jitter(float mixAmount, float offset) {
      float amount = 0.0;
      float scale = 1.0;
      offset += seed;
      for (int power = 0; power < 5; power++) {
        amount += sin((offset * 1234.0 + mixAmount) * scale) / scale;
        scale *= 2.0;
      }

      amount *= 0.09;

      return amount;
    }

    vec3 warp(vec3 v, float scale) {
      return v + scale * vec3(jitter(v.x, 0.0), jitter(v.y, 0.2), jitter(v.z, 1.0));
    }

    float sphereSDF(vec3 samplePoint, vec3 origin, float radius) {
      return length(samplePoint - origin) - radius;
    }

    float sceneSDF(vec3 samplePoint) {
      vec3 warped = warp(samplePoint, 4.0);
      float d = sphereSDF(warped, vec3(0.5, 0.0, 0.0), 1.0);
      d = min(d, sphereSDF(warped, vec3(-0.5, -0.4, 0.2), 0.5));

      return d;
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
        depth += dist;
        if (depth >= end) {
          return end;
        }
      }
      return end;
    }

    vec3 render() {
      vec3 dir = rayDirection(45.0, screenSize, gl_FragCoord.xy);
      vec3 eye = vec3(0.0, 0.0, 8.0);
      float dist = distance(eye, dir, MIN_DIST, MAX_DIST);

      if (dist > MAX_DIST - EPSILON) {
        float d = dot(dir, normalize(vec3(0.0, -1.0, 0.0)));
        d *= 6.0;
        d = d/2.0 + 0.5;
        d = max(0.0, min(1.0, d));
        return mix(vec3(4.0, 40.0, 100.0), vec3(90.0, 100.0, 100.0), d);
      }
    
      return vec3(0.0, 0.0, 0.0);
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

let seed = 4;

onFrame = () => {
  render({ seed });
  seed += 0.000005;
  //requestAnimationFrame(onFrame);
}

onFrame();
