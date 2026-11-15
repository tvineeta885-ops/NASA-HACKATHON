import * as THREE from 'three'

// Work in world space so the light stays attached to the Sun when the camera moves.
const surfaceVertex = `
  varying vec2 texcoord;
  varying vec3 direction;
  varying vec3 worldPoint;
  void main() {
    texcoord = uv;
    direction = normalize(mat3(modelMatrix) * normal);
    worldPoint = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPoint, 1.0);
  }
`

export function makeSolarScene(scene: THREE.Scene) {
  const sunPosition = new THREE.Vector3()
  const solarDirection = new THREE.Vector3()
  const uniforms = {
    dayMap: { value: null as THREE.Texture | null },
    nightMap: { value: null as THREE.Texture | null },
    cloudMap: { value: null as THREE.Texture | null },
    sunDirection: { value: solarDirection },
    cloudOffset: { value: 0 },
  }
  const sphere = new THREE.SphereGeometry(1, 96, 64)
  const planet = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: surfaceVertex,
    fragmentShader: `
      uniform sampler2D dayMap, nightMap, cloudMap;
      uniform vec3 sunDirection;
      uniform float cloudOffset;
      varying vec2 texcoord;
      varying vec3 direction, worldPoint;
      void main() {
        vec3 normal = normalize(direction);
        vec3 view = normalize(cameraPosition - worldPoint);
        float sun = dot(normal, sunDirection);
        float daylight = smoothstep(-0.14, 0.20, sun);
        float clouds = smoothstep(0.11, 0.82, texture2D(cloudMap, vec2(fract(texcoord.x + cloudOffset), texcoord.y)).r);
        vec3 land = texture2D(dayMap, texcoord).rgb;
        vec3 terrain = mix(land, vec3(0.88, 0.88, 0.83), clouds * 0.84);
        vec3 night = terrain * 0.014 + texture2D(nightMap, texcoord).rgb * (0.92 - clouds * 0.45);
        vec3 color = mix(night, terrain * (0.46 + 0.74 * max(sun, 0.0)), daylight);
        float edge = pow(1.0 - max(dot(view, normal), 0.0), 3.0);
        vec3 haze = mix(vec3(0.32, 0.094, 0.032), vec3(0.16, 0.30, 0.36), smoothstep(-0.06, 0.55, sun));
        color += edge * haze * (0.10 + 0.70 * smoothstep(-0.35, 0.32, sun));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
  scene.add(new THREE.Mesh(sphere, planet))

  const air = new THREE.ShaderMaterial({
    uniforms, vertexShader: surfaceVertex, side: THREE.BackSide, transparent: true, depthWrite: false,
    fragmentShader: `
      uniform vec3 sunDirection;
      varying vec3 direction, worldPoint;
      void main() {
        vec3 n = normalize(direction);
        float edge = abs(dot(n, normalize(cameraPosition - worldPoint)));
        float daylight = smoothstep(-0.28, 0.44, dot(n, sunDirection));
        vec3 hue = mix(vec3(0.72, 0.29, 0.12), vec3(0.43, 0.69, 0.77), daylight);
        gl_FragColor = vec4(hue, pow(1.0 - edge, 5.0) * (0.15 + 0.55 * daylight));
      }
    `,
  })
  const atmosphere = new THREE.Mesh(sphere, air)
  atmosphere.scale.setScalar(1.025)
  scene.add(atmosphere)

  const sun = new THREE.Group()
  const disc = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, vertexShader: surfaceVertex,
    fragmentShader: `
      uniform float time;
      varying vec2 texcoord;
      varying vec3 direction, worldPoint;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float grain(vec2 p) {
        vec2 f = fract(p), i = floor(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
      }
      void main() {
        vec2 p = texcoord * vec2(74.0, 38.0);
        float flare = grain(p + grain(p * 0.26) * 2.1 + time * 0.13);
        float limb = abs(dot(normalize(direction), normalize(cameraPosition-worldPoint)));
        vec3 hot = mix(vec3(0.88, 0.20, 0.018), vec3(1.0, 0.94, 0.66), smoothstep(0.01, 1.0, flare * 0.62 + limb * 0.57));
        gl_FragColor = vec4(hot, 1.0);
      }
    `,
  })
  const sunMesh = new THREE.Mesh(sphere, disc)
  sunMesh.scale.setScalar(0.225)
  sun.add(sunMesh)
  const corona = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: disc.uniforms, vertexShader: surfaceVertex,
    fragmentShader: `
      uniform float time;
      varying vec2 texcoord;
      void main() {
        vec2 p = texcoord * 2.0 - 1.0;
        float r = length(p), a = atan(p.y,p.x);
        float rays = 0.75 + 0.25*sin(a*11.0+sin(a*3.0)*2.1+time*0.2);
        float halo = exp(-max(r-0.36,0.0)*9.5) * (1.0-smoothstep(0.45,1.0,r));
        gl_FragColor = vec4(1.0, 0.53, 0.11, halo*rays*0.72);
      }
    `,
  })
  const haloGeometry = new THREE.PlaneGeometry(1.24, 1.24)
  const halo = new THREE.Mesh(haloGeometry, corona)
  sun.add(halo)
  scene.add(sun)

  const values: number[] = []
  const luminosities: number[] = []
  let seed = 397
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let i = 0; i < 1950; i++) {
    const y = random() * 2 - 1
    const a = random() * Math.PI * 2
    const r = Math.sqrt(1 - y * y) * 24
    values.push(Math.cos(a) * r, y * 24, Math.sin(a) * r)
    luminosities.push(0.30 + random() ** 2 * 0.70)
  }
  const stars = new THREE.BufferGeometry()
    .setAttribute('position', new THREE.Float32BufferAttribute(values, 3))
    .setAttribute('light', new THREE.Float32BufferAttribute(luminosities, 1))
  const starlight = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `
      attribute float light;
      varying float ink;
      void main() {
        ink = light;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        gl_PointSize = 1.0 + light * 1.55;
      }
    `,
    fragmentShader: `
      varying float ink;
      void main() {
        float alpha = 1.0-smoothstep(0.05,0.5,length(gl_PointCoord-0.5));
        gl_FragColor = vec4(vec3(0.94,0.90,0.80),alpha*ink);
      }
    `,
  })
  scene.add(new THREE.Points(stars, starlight))

  return {
    setLight(camera: THREE.Camera, compact: boolean) {
      sunPosition.set(compact ? -0.88 : -1.22, compact ? 0.91 : 0.78, 0.54).applyQuaternion(camera.quaternion)
      sun.position.copy(sunPosition)
      solarDirection.copy(sunPosition).normalize()
    },
    setTextures(dayMap: THREE.Texture, nightMap: THREE.Texture, cloudMap: THREE.Texture) {
      uniforms.dayMap.value = dayMap
      uniforms.nightMap.value = nightMap
      uniforms.cloudMap.value = cloudMap
    },
    update(camera: THREE.Camera, elapsed: number) {
      halo.quaternion.copy(camera.quaternion)
      disc.uniforms.time.value = elapsed
      uniforms.cloudOffset.value = (elapsed * 0.00037) % 1
    },
    dispose() {
      for (const item of [sphere, planet, air, disc, corona, haloGeometry, stars, starlight]) item.dispose()
    },
  }
}
