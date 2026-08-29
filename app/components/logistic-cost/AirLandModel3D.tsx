/* eslint-disable react/no-unknown-property */
// @ts-nocheck — react-three-fiber JSX intrinsics (mesh/group/boxGeometry…) rely on
// r3f's global JSX augmentation, which this project's tsconfig doesn't surface.
// This file is copied VERBATIM from the runtime-proven buyer app; the call site
// (CargoDetailsContent) still type-checks against the exported prop interface.
// ─────────────────────────────────────────────────────────────────────────────
// AirLandModel3D — real WebGL (react-three-fiber) 3D model for the AIR and LAND
// delivery modes of the "Logistic Cost" calculator.
//
//   • LAND → a solid truck: box trailer (translucent) + blue cab with windshield
//            + cylindrical wheels, cargo boxes packed on the bed.
//   • AIR  → a real IATA ULD whose SHAPE is driven by the DB record:
//              box        → plain aluminium container   (LD-4/9/11, reefers)
//              contoured  → one angled bottom corner     (LD-1/2/3)
//              trapezoid  → both bottom corners angled    (LD-6/8/26/29/39)
//              pallet     → wooden deck + cargo net       (LD-7, PMC…)
//
// Container dimensions (metres) and the shape come straight from the existing
// /trucks and /air-cargo endpoints — nothing about the geometry is hardcoded per
// product; only the envelope style is chosen from the container's own record.
// ─────────────────────────────────────────────────────────────────────────────
"use client";
import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges } from "@react-three/drei";
import * as THREE from "three";

export interface Model3DProduct {
  length: number; // metres
  width: number;
  height: number;
  color: string;
  qty: number;
  name?: string;
}

export interface AirLandModel3DProps {
  modelType: "air" | "land";
  uldShape?: "box" | "contoured" | "trapezoid" | "pallet";
  uldCode?: string; // IATA ULD code (e.g. "AKE") — printed on the container
  dims: { length: number; width: number; height: number }; // metres (inside)
  products: Model3DProduct[];
  className?: string;
}

// ── Grid-pack the products into the container envelope (metres) ──
// x = length, y = height (up), z = width/depth. Container centred on x/z, floor y=0.
interface Placement {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
}
// Chamfer of the ULD contour — MUST match useUldGeometry so the cargo follows
// the exact same angled profile as the shell.
// Gentle ULD contour angle. (Was 0.38/0.40 — so steep the bottom layer of a
// trapezoid/contoured ULD had NO room for a carton, which left the container
// rendering empty. Softer angle → cargo sits on the floor and the silhouette
// still reads as a real ULD.)
const uldChamfer = (H: number, W: number) => Math.min(H * 0.2, W * 0.2);

function packBoxes(
  dims: { length: number; width: number; height: number },
  products: Model3DProduct[],
  shape: string = "box",
  ch: number = 0,
): Placement[] {
  const { length: L, width: W, height: H } = dims;
  const out: Placement[] = [];
  let yBase = 0;
  const gap = 0.02; // visible seam between cartons so they don't merge into a slab

  // A cell's outboard-bottom edge must sit INSIDE the ULD profile, so the cargo
  // follows the contour (no boxes in the angled dead-space corner).
  const insideContour = (zEdge: number, yb: number): boolean => {
    if (ch <= 0) return true;
    if (shape === "contoured") {
      // After the extrude + rotateY(90°) the angled corner lands on the −z side,
      // so the dead-space is at z ≈ −W/2, low y. Keep cargo on the +z side of the
      // contour line so it follows the SAME slope as the shell.
      return zEdge >= -(W / 2 - ch + yb) - 1e-6;
    }
    if (shape === "trapezoid") {
      return (
        zEdge <= W / 2 - ch + yb + 1e-6 && zEdge >= -(W / 2 - ch + yb) - 1e-6
      );
    }
    return true;
  };

  for (const p of products) {
    if (!p || p.qty <= 0 || p.length <= 0 || p.width <= 0 || p.height <= 0)
      continue;
    const l = Math.min(p.length, L);
    const w = Math.min(p.width, W);
    const h = Math.min(p.height, H);
    const cols = Math.max(1, Math.floor(L / l));
    const rows = Math.max(1, Math.floor(W / w));
    let remaining = p.qty;
    let guard = 0;
    while (remaining > 0 && yBase + h <= H + 1e-6 && guard < 6000) {
      // valid cells for THIS layer (contour widens as we go up)
      const cells: [number, number][] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = -L / 2 + l / 2 + col * l;
          const z = -W / 2 + w / 2 + row * w;
          if (
            insideContour(z + w / 2, yBase) &&
            insideContour(z - w / 2, yBase)
          ) {
            cells.push([x, z]);
          }
        }
      }
      // A ULD contour is NARROW at the floor and WIDENS going up, so an empty
      // bottom layer must NOT stop the pack — advance up and keep filling (the
      // old `break` here returned zero cargo for trapezoid ULDs). The while's
      // height bound + guard still terminate the loop.
      if (cells.length === 0) {
        yBase += h;
        guard++;
        continue;
      }
      for (const [x, z] of cells) {
        if (remaining <= 0) break;
        out.push({
          pos: [x, yBase + h / 2, z],
          size: [l - gap, h - gap, w - gap],
          color: p.color || "#10b981",
        });
        remaining--;
        guard++;
      }
      yBase += h;
    }
  }
  return out;
}

// ── ULD envelope geometry from the shape flag ──
function useUldGeometry(
  shape: string,
  L: number,
  W: number,
  H: number,
): THREE.BufferGeometry {
  return useMemo(() => {
    if (shape === "box" || shape === "pallet") {
      return new THREE.BoxGeometry(L, H, W);
    }
    const ch = uldChamfer(H, W);
    const s = new THREE.Shape();
    // Profile in (x = width, y = height); extruded along length below.
    if (shape === "contoured") {
      // one angled bottom corner (outboard)
      s.moveTo(-W / 2, 0);
      s.lineTo(W / 2 - ch, 0);
      s.lineTo(W / 2, ch);
      s.lineTo(W / 2, H);
      s.lineTo(-W / 2, H);
      s.closePath();
    } else {
      // trapezoid — both bottom corners angled
      s.moveTo(-W / 2 + ch, 0);
      s.lineTo(W / 2 - ch, 0);
      s.lineTo(W / 2, ch);
      s.lineTo(W / 2, H);
      s.lineTo(-W / 2, H);
      s.lineTo(-W / 2, ch);
      s.closePath();
    }
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: L,
      bevelEnabled: false,
    });
    geo.translate(0, 0, -L / 2); // centre the length
    geo.rotateY(Math.PI / 2); // local z (length) → world x
    return geo;
  }, [shape, L, W, H]);
}

const Cargo: React.FC<{ placements: Placement[] }> = ({ placements }) => (
  <group>
    {placements.map((b, i) => (
      <mesh key={i} position={b.pos} castShadow receiveShadow>
        <boxGeometry args={b.size} />
        <meshStandardMaterial
          color={b.color}
          metalness={0.05}
          roughness={0.6}
        />
        {/* dark outline so each carton reads as a distinct box, not a slab */}
        <Edges threshold={15} color="#1e2a22" />
      </mesh>
    ))}
  </group>
);

// ── Aluminium corner frame (posts + top/bottom rails) for a solid container look ──
const ContainerFrame: React.FC<{ L: number; W: number; H: number }> = ({
  L,
  W,
  H,
}) => {
  const t = Math.max(0.03, Math.min(L, W) * 0.05);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#97a1b0",
        metalness: 0.3,
        roughness: 0.4,
      }),
    [],
  );
  const px = L / 2 - t / 2;
  const pz = W / 2 - t / 2;
  const corners: [number, number][] = [
    [px, pz],
    [px, -pz],
    [-px, pz],
    [-px, -pz],
  ];
  return (
    <group>
      {/* vertical corner posts */}
      {corners.map(([x, z], i) => (
        <mesh key={`p${i}`} position={[x, H / 2, z]} material={mat}>
          <boxGeometry args={[t, H, t]} />
        </mesh>
      ))}
      {/* top + bottom rails */}
      {[0, H].map((y, yi) => (
        <group key={`r${yi}`}>
          <mesh position={[0, y, pz]} material={mat}>
            <boxGeometry args={[L, t, t]} />
          </mesh>
          <mesh position={[0, y, -pz]} material={mat}>
            <boxGeometry args={[L, t, t]} />
          </mesh>
          <mesh position={[px, y, 0]} material={mat}>
            <boxGeometry args={[t, t, W]} />
          </mesh>
          <mesh position={[-px, y, 0]} material={mat}>
            <boxGeometry args={[t, t, W]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ── IATA-code placard (canvas texture → plane on the ULD's front) ──
const UldLabel: React.FC<{
  code: string;
  L: number;
  W: number;
  H: number;
}> = ({ code, L, W, H }) => {
  const texture = useMemo(() => {
    if (typeof document === "undefined" || !code) return null;
    const cv = document.createElement("canvas");
    cv.width = 320;
    cv.height = 160;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#eef1f6";
    ctx.fillRect(0, 0, 320, 160);
    ctx.strokeStyle = "#7c8797";
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 304, 144);
    ctx.fillStyle = "#28313f";
    ctx.font = "bold 78px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(code.slice(0, 6), 160, 84);
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    return t;
  }, [code]);
  if (!texture) return null;
  const lw = Math.min(L * 0.55, W * 0.9, 0.9);
  const lh = lw / 2;
  return (
    <mesh position={[-L / 2 + lw / 2 + 0.04, H * 0.82, W / 2 + 0.012]}>
      <planeGeometry args={[lw, lh]} />
      <meshStandardMaterial
        map={texture}
        transparent
        metalness={0}
        roughness={0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// ── ULD model ──
const UldModel: React.FC<{
  shape: string;
  code?: string;
  dims: { length: number; width: number; height: number };
  placements: Placement[];
}> = ({ shape, code = "", dims, placements }) => {
  const { length: L, width: W, height: H } = dims;
  const geo = useUldGeometry(shape, L, W, H);

  if (shape === "pallet") {
    const deckThk = Math.max(0.05, H * 0.05);
    const netGeo = new THREE.BoxGeometry(L, H, W);
    return (
      <group position={[0, 0, 0]}>
        {/* wooden pallet deck */}
        <mesh position={[0, -deckThk / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[L, deckThk, W]} />
          <meshStandardMaterial color="#b9822f" roughness={0.85} />
        </mesh>
        <group position={[0, 0, 0]}>
          <Cargo placements={placements} />
        </group>
        {/* cargo net — wireframe box over the load */}
        <lineSegments position={[0, H / 2, 0]}>
          <edgesGeometry args={[netGeo]} />
          <lineBasicMaterial color="#3a4453" />
        </lineSegments>
        <mesh position={[0, H / 2, 0]}>
          <boxGeometry args={[L, H, W]} />
          <meshStandardMaterial
            color="#dfe4ec"
            transparent
            opacity={0.06}
            metalness={0.2}
            roughness={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    );
  }

  // container shapes (box / contoured / trapezoid): SOLID aluminium ULD in its
  // real (contoured) silhouette, rendered OPEN-FRONT (BackSide) — the metal
  // far/side/top walls stay solid & opaque like the IATA reference, while the
  // near wall opens up so the packed goods are clearly visible inside. Floor is
  // a solid slab the cargo sits on. IATA code printed on it.
  const shellPos: [number, number, number] =
    shape === "box" ? [0, H / 2, 0] : [0, 0, 0];
  const floorThk = Math.max(0.03, H * 0.04);
  return (
    <group>
      {/* solid metallic floor slab (cargo sits on top at y = 0) */}
      <mesh position={[0, -floorThk / 2, 0]} receiveShadow>
        <boxGeometry args={[L, floorThk, W]} />
        <meshStandardMaterial
          color="#aeb8c6"
          metalness={0.25}
          roughness={0.4}
        />
      </mesh>

      {/* goods, visible inside the open container */}
      <Cargo placements={placements} />

      {/* solid brushed-aluminium walls — BackSide opens the near wall so you
          see in, while the far/side/top walls render as an opaque backdrop */}
      <mesh geometry={geo} position={shellPos} castShadow>
        <meshStandardMaterial
          color="#c7cfda"
          metalness={0.28}
          roughness={0.42}
          side={THREE.BackSide}
        />
      </mesh>
      {/* full metal outline (all edges) so the ULD shape stays crisp */}
      <lineSegments geometry={geo} position={shellPos}>
        <lineBasicMaterial color="#6b7686" />
      </lineSegments>

      {/* IATA ULD code placard */}
      <UldLabel code={code} L={L} W={W} H={H} />
    </group>
  );
};

// ── Truck model ──
const TruckModel: React.FC<{
  dims: { length: number; width: number; height: number };
  placements: Placement[];
}> = ({ dims, placements }) => {
  const { length: L, width: W, height: H } = dims;
  const wheelR = Math.min(W, H) * 0.14;
  const wheelW = W * 0.16;
  // Cab scales with the truck (no fixed minimum that dwarfs a mini-truck).
  const cabL = Math.min(Math.max(L * 0.22, 0.4), 2.4);
  const cabH = Math.min(H * 0.92, H + 0.3);
  const trailerGeo = useMemo(() => new THREE.BoxGeometry(L, H, W), [L, H, W]);
  // Rear axles sit just INSIDE the back of the trailer (x = +L/2 is the rear).
  // Long trucks get a rear tandem; a mid axle is added for very long trailers.
  const rearX = L / 2 - wheelR * 1.6;
  const wheelXs =
    L > 9
      ? [rearX, rearX - wheelR * 2.6, 0]
      : L > 6
        ? [rearX, rearX - wheelR * 2.6]
        : [rearX];
  const axleZ = W / 2 - wheelW / 2;

  return (
    <group>
      {/* cargo sits on the bed (y = 0 .. H) */}
      <Cargo placements={placements} />

      {/* box-trailer shell (BackSide → open near wall, see the load) + edges */}
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[L, H, W]} />
        <meshStandardMaterial
          color="#dbe1ea"
          metalness={0.2}
          roughness={0.55}
          transparent
          opacity={0.32}
          side={THREE.BackSide}
        />
      </mesh>
      <lineSegments position={[0, H / 2, 0]}>
        <edgesGeometry args={[trailerGeo]} />
        <lineBasicMaterial color="#7c8797" />
      </lineSegments>

      {/* chassis rail */}
      <mesh position={[L * 0.02, -wheelR * 0.4, 0]}>
        <boxGeometry args={[L * 1.02, wheelR * 0.5, W * 0.7]} />
        <meshStandardMaterial color="#4b5563" metalness={0.2} roughness={0.7} />
      </mesh>

      {/* cab */}
      <group position={[-L / 2 - cabL / 2, 0, 0]}>
        <mesh position={[0, cabH / 2, 0]} castShadow>
          <boxGeometry args={[cabL, cabH, W * 0.98]} />
          <meshStandardMaterial
            color="#2f6ad0"
            metalness={0.1}
            roughness={0.5}
          />
        </mesh>
        {/* windshield */}
        <mesh position={[-cabL / 2 - 0.01, cabH * 0.72, 0]}>
          <boxGeometry args={[0.02, cabH * 0.34, W * 0.8]} />
          <meshStandardMaterial
            color="#bcd6f5"
            metalness={0.2}
            roughness={0.25}
          />
        </mesh>
      </group>

      {/* wheels — cylinders, axis along z (width) */}
      {wheelXs.map((x, i) =>
        [axleZ, -axleZ].map((z, j) => (
          <mesh
            key={`${i}-${j}`}
            position={[x, -wheelR * 0.6, z]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[wheelR, wheelR, wheelW, 22]} />
            <meshStandardMaterial color="#1b2430" roughness={0.8} />
          </mesh>
        )),
      )}
      {/* cab front wheels */}
      {[axleZ, -axleZ].map((z, j) => (
        <mesh
          key={`cab-${j}`}
          position={[-L / 2 - cabL * 0.5, -wheelR * 0.6, z]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[wheelR, wheelR, wheelW, 22]} />
          <meshStandardMaterial color="#1b2430" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};

const AirLandModel3D: React.FC<AirLandModel3DProps> = ({
  modelType,
  uldShape = "box",
  uldCode = "",
  dims,
  products,
  className,
}) => {
  const packShape = modelType === "air" ? uldShape : "box";
  const packCh =
    packShape === "contoured" || packShape === "trapezoid"
      ? uldChamfer(dims.height, dims.width)
      : 0;
  const placements = useMemo(
    () => packBoxes(dims, products, packShape, packCh),
    [dims, products, packShape, packCh],
  );
  const span = Math.max(dims.length, dims.width, dims.height, 0.5);
  const camDist = span * 1.9 + 1.5;
  const groundY = -Math.min(dims.width, dims.height) * 0.34;

  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [camDist * 0.9, camDist * 0.7, camDist], fov: 38 }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#f5f7fa"]} />
        <hemisphereLight args={["#ffffff", "#9aa3b0", 0.9]} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[span * 2, span * 3, span * 2]}
          intensity={1.25}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight
          position={[-span, span * 1.5, -span]}
          intensity={0.5}
        />

        <group position={[0, 0, 0]}>
          {modelType === "land" ? (
            <TruckModel dims={dims} placements={placements} />
          ) : (
            <UldModel
              shape={uldShape}
              code={uldCode}
              dims={dims}
              placements={placements}
            />
          )}
          {/* ground */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, groundY, 0]}
            receiveShadow
          >
            <planeGeometry args={[span * 6, span * 6]} />
            <meshStandardMaterial color="#e6eaf0" roughness={1} />
          </mesh>
        </group>

        <OrbitControls
          enablePan={false}
          minDistance={span * 0.9}
          maxDistance={span * 5}
          target={[0, dims.height * 0.35, 0]}
        />
      </Canvas>
    </div>
  );
};

export default AirLandModel3D;
