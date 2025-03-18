import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import * as CANNON from 'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';


const CannonDebugRenderer = function(scene, world, options){
    options = options || {};

    this.scene = scene;
    this.world = world;

    this._meshes = [];

    this._material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
    this._sphereGeometry = new THREE.SphereGeometry(1);
    this._boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this._planeGeometry = new THREE.PlaneGeometry( 10, 10, 10, 10 );
    this._cylinderGeometry = new THREE.CylinderGeometry( 1, 1, 10, 10 );
};

CannonDebugRenderer.prototype = {

    tmpVec0: new CANNON.Vec3(),
    tmpVec1: new CANNON.Vec3(),
    tmpVec2: new CANNON.Vec3(),
    tmpQuat0: new CANNON.Vec3(),

    update: function(){

        var bodies = this.world.bodies;
        var meshes = this._meshes;
        var shapeWorldPosition = this.tmpVec0;
        var shapeWorldQuaternion = this.tmpQuat0;

        var meshIndex = 0;

        for (var i = 0; i !== bodies.length; i++) {
            var body = bodies[i];

            for (var j = 0; j !== body.shapes.length; j++) {
                var shape = body.shapes[j];

                this._updateMesh(meshIndex, body, shape);

                var mesh = meshes[meshIndex];

                if(mesh){

                    // Get world position
                    body.quaternion.vmult(body.shapeOffsets[j], shapeWorldPosition);
                    body.position.vadd(shapeWorldPosition, shapeWorldPosition);

                    // Get world quaternion
                    body.quaternion.mult(body.shapeOrientations[j], shapeWorldQuaternion);

                    // Copy to meshes
                    mesh.position.copy(shapeWorldPosition);
                    mesh.quaternion.copy(shapeWorldQuaternion);
                }

                meshIndex++;
            }
        }

        for(var i = meshIndex; i < meshes.length; i++){
            var mesh = meshes[i];
            if(mesh){
                this.scene.remove(mesh);
            }
        }

        meshes.length = meshIndex;
    },

    _updateMesh: function(index, body, shape){
        var mesh = this._meshes[index];
        if(!this._typeMatch(mesh, shape)){
            if(mesh){
                this.scene.remove(mesh);
            }
            mesh = this._meshes[index] = this._createMesh(shape);
        }
        this._scaleMesh(mesh, shape);
    },

    _typeMatch: function(mesh, shape){
        if(!mesh){
            return false;
        }
        var geo = mesh.geometry;
        return (
            (geo instanceof THREE.SphereGeometry && shape instanceof CANNON.Sphere) ||
            (geo instanceof THREE.BoxGeometry && shape instanceof CANNON.Box) ||
            (geo instanceof THREE.PlaneGeometry && shape instanceof CANNON.Plane) ||
            (geo.id === shape.geometryId && shape instanceof CANNON.ConvexPolyhedron) ||
            (geo.id === shape.geometryId && shape instanceof CANNON.Trimesh) ||
            (geo.id === shape.geometryId && shape instanceof CANNON.Heightfield)
        );
    },

    _createMesh: function(shape){
        var mesh;
        var material = this._material;

        switch(shape.type){

        case CANNON.Shape.types.SPHERE:
            mesh = new THREE.Mesh(this._sphereGeometry, material);
            break;

        case CANNON.Shape.types.BOX:
            mesh = new THREE.Mesh(this._boxGeometry, material);
            break;

        case CANNON.Shape.types.PLANE:
            mesh = new THREE.Mesh(this._planeGeometry, material);
            break;

        // case CANNON.Shape.types.CONVEXPOLYHEDRON:
        //     // Create mesh
        //     var geo = new THREE.Geometry();

        //     // Add vertices
        //     for (var i = 0; i < shape.vertices.length; i++) {
        //         var v = shape.vertices[i];
        //         geo.vertices.push(new THREE.Vector3(v.x, v.y, v.z));
        //     }

        //     for(var i=0; i < shape.faces.length; i++){
        //         var face = shape.faces[i];

        //         // add triangles
        //         var a = face[0];
        //         for (var j = 1; j < face.length - 1; j++) {
        //             var b = face[j];
        //             var c = face[j + 1];
        //             geo.faces.push(new THREE.Face3(a, b, c));
        //         }
        //     }
        //     geo.computeBoundingSphere();
        //     geo.computeFaceNormals();

        //     mesh = new THREE.Mesh(geo, material);
        //     shape.geometryId = geo.id;
        //     break;

        case CANNON.Shape.types.CONVEXPOLYHEDRON:
            // Create BufferGeometry instead of Geometry
            const geo = new THREE.BufferGeometry();

            // Prepare vertex and face data
            const vertices = [];
            const indices = [];

            // Add vertices
            for (let i = 0; i < shape.vertices.length; i++) {
                const v = shape.vertices[i];
                vertices.push(v.x, v.y, v.z); // BufferGeometry uses a flat array
            }

            // Add faces (triangles)
            for (let i = 0; i < shape.faces.length; i++) {
                const face = shape.faces[i];
                const a = face[0]; // First vertex index
                for (let j = 1; j < face.length - 1; j++) {
                    const b = face[j];
                    const c = face[j + 1];
                    indices.push(a, b, c); // Add triangle indices
                }
            }

            // Set BufferGeometry attributes
            geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); // 3 components per vertex (x, y, z)
            geo.setIndex(indices); // Define the triangles
            geo.computeVertexNormals(); // Equivalent to computeFaceNormals in Geometry
            geo.computeBoundingSphere(); // Same as before

            // Create mesh
            mesh = new THREE.Mesh(geo, material);
            shape.geometryId = geo.id; // BufferGeometry still has an id
            break;

        case CANNON.Shape.types.TRIMESH:
            var geometry = new THREE.Geometry();
            var v0 = this.tmpVec0;
            var v1 = this.tmpVec1;
            var v2 = this.tmpVec2;
            for (var i = 0; i < shape.indices.length / 3; i++) {
                shape.getTriangleVertices(i, v0, v1, v2);
                geometry.vertices.push(
                    new THREE.Vector3(v0.x, v0.y, v0.z),
                    new THREE.Vector3(v1.x, v1.y, v1.z),
                    new THREE.Vector3(v2.x, v2.y, v2.z)
                );
                var j = geometry.vertices.length - 3;
                geometry.faces.push(new THREE.Face3(j, j+1, j+2));
            }
            geometry.computeBoundingSphere();
            geometry.computeFaceNormals();
            mesh = new THREE.Mesh(geometry, material);
            shape.geometryId = geometry.id;
            break;

        case CANNON.Shape.types.HEIGHTFIELD:
            var geometry = new THREE.Geometry();

            var v0 = this.tmpVec0;
            var v1 = this.tmpVec1;
            var v2 = this.tmpVec2;
            for (var xi = 0; xi < shape.data.length - 1; xi++) {
                for (var yi = 0; yi < shape.data[xi].length - 1; yi++) {
                    for (var k = 0; k < 2; k++) {
                        shape.getConvexTrianglePillar(xi, yi, k===0);
                        v0.copy(shape.pillarConvex.vertices[0]);
                        v1.copy(shape.pillarConvex.vertices[1]);
                        v2.copy(shape.pillarConvex.vertices[2]);
                        v0.vadd(shape.pillarOffset, v0);
                        v1.vadd(shape.pillarOffset, v1);
                        v2.vadd(shape.pillarOffset, v2);
                        geometry.vertices.push(
                            new THREE.Vector3(v0.x, v0.y, v0.z),
                            new THREE.Vector3(v1.x, v1.y, v1.z),
                            new THREE.Vector3(v2.x, v2.y, v2.z)
                        );
                        var i = geometry.vertices.length - 3;
                        geometry.faces.push(new THREE.Face3(i, i+1, i+2));
                    }
                }
            }
            geometry.computeBoundingSphere();
            geometry.computeFaceNormals();
            mesh = new THREE.Mesh(geometry, material);
            shape.geometryId = geometry.id;
            break;
        }

        if(mesh){
            this.scene.add(mesh);
        }

        return mesh;
    },

    _scaleMesh: function(mesh, shape){
        switch(shape.type){

        case CANNON.Shape.types.SPHERE:
            var radius = shape.radius;
            mesh.scale.set(radius, radius, radius);
            break;

        case CANNON.Shape.types.BOX:
            mesh.scale.copy(shape.halfExtents);
            mesh.scale.multiplyScalar(2);
            break;

        case CANNON.Shape.types.CONVEXPOLYHEDRON:
            mesh.scale.set(1,1,1);
            break;

        case CANNON.Shape.types.TRIMESH:
            mesh.scale.copy(shape.scale);
            break;

        case CANNON.Shape.types.HEIGHTFIELD:
            mesh.scale.set(1,1,1);
            break;

        }
    }
};


    


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100000000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('container').appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();

const skyR = 1000000;
const skyGeom = new THREE.SphereGeometry(skyR, 64, 64);
const skyTexture = textureLoader.load('starmap.png');
const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.DoubleSide,
    color: new THREE.Color(0.1, 0.1, 0.1)
});

const sky = new THREE.Mesh(skyGeom, skyMaterial);
sky.position.set(0, 0, 0);
scene.add(sky);


const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 0.1;
controls.maxDistance = 2;



const world = new CANNON.World();
world.gravity.set(0, 0, 0);

var cannonDebugRenderer = new CannonDebugRenderer( scene, world );


const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(100, 100, 100);
scene.add(directionalLight);



const earthRadius = 6371;
const earthMass = 5.972e24;
const G = 6.6743e-20;

const axesHelper = new THREE.AxesHelper(500);
// scene.add(axesHelper);


const earthTexture = textureLoader.load('1_earth_8k.jpg');
const earthMaterial = new THREE.MeshPhongMaterial({
    map: earthTexture,
    side: THREE.DoubleSide,
    // emissive: 0xffffff,
    // emissiveIntensity: 2,

})
const earthGeometry = new THREE.SphereGeometry(earthRadius, 128, 128);
const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);

// const clouds = textureLoader.load('2k_earth_clouds.jpg');
// const cloudMaterial = new THREE.MeshPhongMaterial({
//     map: clouds, 
//     transparent: true,
//     alphaMap: clouds,
//     side: THREE.DoubleSide,
    
// })
// const cloudGeometry = new THREE.SphereGeometry(earthRadius, 128, 128);
// const cloudsMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);



earthMesh.position.set(0, -earthRadius, 0);
// cloudsMesh.position.set(0,-earthRadius-2.5,0);
scene.add(earthMesh);
// scene.add(cloudsMesh)



const earthShape = new CANNON.Sphere(earthRadius);
const earthBody = new CANNON.Body({
    mass: earthMass,
    position: new CANNON.Vec3(0, -earthRadius, 0)
});
earthBody.addShape(earthShape);
earthBody.type = CANNON.Body.STATIC;
world.addBody(earthBody);


earthMesh.rotateX(THREE.MathUtils.degToRad(-63))
earthMesh.rotateY(THREE.MathUtils.degToRad(-9))



renderer.autoClear = false;
// renderer.setSize(window.innerWidth, window.innerHeight);
// renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
// renderer.setClearColor(0x000000, 0.0);




// const atmosphereGeometry = new THREE.SphereGeometry(earthRadius+100, 32, 32); // Slightly larger than Earth
// const atmosphereMaterial = new THREE.MeshStandardMaterial({
//     emissive: 0x0073ff,
//     emissiveIntensity: 1,
//     transparent: true,
//     opacity: 1,   // Adjust for desired transparency
//     side: THREE.DoubleSide, // Render the inside of the sphere for a halo effect
//     blending: THREE.AdditiveBlending
// });
// const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
// scene.add(atmosphere);

// // Atmosphere
// const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.03, 64, 64); // Slightly larger
// const atmosphereMaterial = new THREE.MeshPhongMaterial({
//     emissive: 0xbfbfbf,
//     emissiveIntensity: 3,
//   color: 0xbfbfbf, // Light blue glow
//   transparent: true,
//   opacity: 1, // Low opacity for subtlety
//   blending: THREE.AdditiveBlending, // Adds glow without blocking Earth
//   side: THREE.BackSide, // Render inside the sphere
// });
// const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
// scene.add(atmosphere);
// atmosphere.position.set(0, -earthRadius, 0);
// atmosphereMaterial.depthWrite = false;


////nananananan
// //bloom renderer
// const renderScene = new RenderPass(scene, camera);
// const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
// bloomPass.threshold = 0.9;
// bloomPass.strength = 1;
// bloomPass.radius = 1;
// const bloomComposer = new EffectComposer(renderer);
// bloomComposer.setSize(window.innerWidth, window.innerHeight);
// bloomComposer.renderToScreen = true;
// bloomComposer.addPass(renderScene);
// bloomComposer.addPass(bloomPass);
///////////////


// const composer = new EffectComposer(renderer);
// const renderPass = new RenderPass(scene, camera);
// composer.addPass(renderPass);

// const bloomPass = new UnrealBloomPass(
//   new THREE.Vector2(window.innerWidth, window.innerHeight), // Resolution
//   1,  // Strength (low for subtlety)
//   1,  // Radius (controls spread)
//   1   // Threshold (high to limit bloom to bright areas)
// );
// composer.addPass(bloomPass);
  


const offsetOfBoosterFromBase = 0.02;


const boosterShape = new CANNON.Cylinder(0.005, 0.005, 0.069, 32);
const boosterBody = new CANNON.Body({
    mass: 3000e3,
    position: new CANNON.Vec3(0, offsetOfBoosterFromBase+0.069/2, 0)
});
boosterBody.addShape(boosterShape)
world.addBody(boosterBody);


const shipShape = new CANNON.Cylinder(0.005, 0.005, 0.046, 32);
const shipBody = new CANNON.Body({
    mass: 500e3,
    position: new CANNON.Vec3(0, offsetOfBoosterFromBase+0.069+0.047/2, 0)
});
shipBody.addShape(shipShape);
world.addBody(shipBody);

shipBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
boosterBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);



const c = new CANNON.LockConstraint(boosterBody, shipBody);
world.addConstraint(c);



let allCam = ["Booster", "Ship", "Base", "Tower"]
let cam = allCam[2];

const loader = new GLTFLoader();

let shipModel, boosterModel, towerModel;
let shipHeight, boosterHeight, towerHeight;

loader.load('launchtower.glb', (gltf) => {
    towerModel = gltf.scene;
    towerModel.scale.set(0.003, 0.003, 0.003);
    const towerBox = new THREE.Box3().setFromObject(towerModel);
    towerHeight = towerBox.max.y - towerBox.min.y;
    console.log("tower height", towerHeight);
    scene.add(towerModel);
});


loader.load('booster2.glb', (gltf) => {
    boosterModel = gltf.scene;
    scene.add(boosterModel);

    boosterModel.traverse((child) => {
        if (child.isMesh) {

            const material = child.material;
            // console.log(material); 
            material.roughness = 0.7;
            material.metalness = 0.7;
            material.needsUpdate = true;
        }
    });

    boosterModel.scale.set(0.0115,0.0115,0.0115);

    const boosterBox = new THREE.Box3().setFromObject(boosterModel);
    boosterHeight = boosterBox.max.z - boosterBox.min.z;


    loader.load('ship2.glb', (gltf) => {
        shipModel = gltf.scene;
        scene.add(shipModel);

        shipModel.traverse((child) => {
            if (child.isMesh) {
                const material = child.material;
                // console.log(material); 
                material.roughness = 0.7;
                material.metalness = 0.7;
                material.needsUpdate = true;
            }
        });

        shipModel.scale.set(0.0115,0.0115,0.0115);

        const shipBox = new THREE.Box3().setFromObject(shipModel);
        shipHeight = shipBox.max.z - shipBox.min.z;

        console.log("ship height", shipHeight);
        console.log("booster height", boosterHeight);


        const totalHeight = boosterHeight + shipHeight;
        console.log("total height", totalHeight);

        camera.position.copy(shipModel.position).add(new THREE.Vector3(0, 0.2, 0.2));
        camera.lookAt(shipModel.position);
        

    });
});


// const flameGeometry = new THREE.CylinderGeometry(0.005, 0.001, 0.07, 16);
// const flameMaterial = new THREE.MeshBasicMaterial({
//   color: 0xff4500, // Orange-red color
//   transparent: true,
//   opacity: 0.7,
// });
// const flame = new THREE.Mesh(flameGeometry, flameMaterial);
// // flame.rotation.x = Math.PI;
// flame.position.set(0, -2, 0); // Assuming rocket is at (0, 0, 0), adjust Y as needed
// scene.add(flame);




let time = 0;
let seperated = false;
let doneBoostback = false;


function calculateGravitationalForce(body1, body2) {
    const rVec = body1.position.clone().vsub(body2.position); 
    const distance = rVec.norm();
    const gravForceMagnitude = (G * body1.mass * body2.mass) / (distance * distance);
    const gravForce = rVec.unit().scale(-gravForceMagnitude);
    
    return gravForce;
}



// console.log(world.solver);
world.solver.iterations = 10;  //very very important
// world.solver.tolerance = 0;




const particleCount = 1000;
const geometry = new THREE.BufferGeometry();
const vertices = new Float32Array(particleCount * 3);
for (let i = 0; i < vertices.length; i += 3) {
    vertices[i] = (Math.random() - 0.5) * 0.005;  // -5 5
    vertices[i + 1] = (Math.random() - 1) * 0.05;
    vertices[i + 2] = (Math.random() - 0.5) * 0.005; // -5 5
}
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));


const colors = new Float32Array(particleCount * 4);
for (let i = 0; i < colors.length; i += 4) {
    colors[i] = 0;
    colors[i + 1] = 0;
    colors[i + 2] = 0;
    colors[i + 3] = 1;
}
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

const material = new THREE.PointsMaterial({
    size: 1,           // Size of each particle
    color: 0xffffff,     // Particle color
    transparent: true,   // Enable transparency if needed
    opacity: 1,
    sizeAttenuation: false,
    vertexColors: true,
});

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

const timeAfterSeperation = 0;


function getDist(obj1, obj2){
    return obj1.position.sub(obj2.position);
}

let threeInitial, targetQuaternion;
let t = 0;
let t2 = 0;
const speed = 0.005;
let oriented = false;

let initial;



// renderer.render(scene, camera);

const boosterCam = document.getElementById("booster-cam");
const shipCam = document.getElementById("ship-cam");
const baseCam = document.getElementById("base-cam");
const towerCam = document.getElementById("tower-cam");

boosterCam.addEventListener("click", function(){
    cam = allCam[0];
});

shipCam.addEventListener("click", function(){
    cam = allCam[1];
});

baseCam.addEventListener("click", function(){
    cam = allCam[2];
});

towerCam.addEventListener("click", function(){
    cam = allCam[3];
});

let boostbackTime = 0;




let getSlerp = false;

function animate() {


    requestAnimationFrame(animate);


    


    // world.step(1 / 10);

 
   

    const fastForwardFactor = 1; // Simulate 10x faster
    const baseTimestep = 1/60; // Stable timestep
    // for (let i = 0; i < fastForwardFactor; i++) {
    world.step(baseTimestep); // Multiple small steps
    time += baseTimestep;
    // }



    const gravForceBooster = calculateGravitationalForce(boosterBody, earthBody)
    const magAdjusted = new CANNON.Vec3(gravForceBooster.x, gravForceBooster.z, gravForceBooster.y);
    boosterBody.applyForce(gravForceBooster, boosterBody.position);

    const gravForceShip = calculateGravitationalForce(shipBody, earthBody)
    const magAdjusted2 = new CANNON.Vec3(gravForceShip.x, gravForceShip.z, gravForceShip.y);
    shipBody.applyForce(gravForceShip, shipBody.position);

    boosterBody.linearDamping = 0.001;
    boosterBody.angularDamping = 0.1;
    shipBody.linearDamping = 0.001;
    shipBody.angularDamping = 0.1;

    // console.log(magAdjusted);
    // console.log(magAdjusted2);



    const rocketForward = new CANNON.Vec3(0, 0, 1); // Local y-axis
    const worldForward = shipBody.quaternion.vmult(rocketForward); // Transform to world space
    const rVec = shipBody.position.vsub(earthBody.position)
    const dotProduct = worldForward.dot(rVec.unit());
    const angleToRadial = Math.acos(dotProduct) * (180 / Math.PI); // Degrees
    const angleToTangent = 90 - angleToRadial; // Angle to desired perpendicular
    // console.log(angleToTangent);


    const boosterDistance = boosterBody.position.vsub(earthBody.position).norm(); 
    const shipDistance = shipBody.position.vsub(earthBody.position).norm(); 
    const boosterAltitude = boosterDistance - earthRadius;
    const shipAltitude = shipDistance - earthRadius;
    const shipVelocity = shipBody.velocity.norm();
    const boosterVelocity = boosterBody.velocity.norm();

    const axesHelper = new THREE.AxesHelper(10);

    // Attach the AxesHelper to the cube
    // boosterModel.add(axesHelper);
    

    let boosterThrust;
    let shipThrust;


    particleSystem.visible = false;



    const d = getDist(boosterModel, shipModel);
    // console.log(d.length())

    if(seperated && d.length()>0.5 && !doneBoostback){
        console.log("doing boostback");

        const toLandingSite = towerModel.position.clone().sub(boosterModel.position).normalize().negate();
        const upVec = new THREE.Vector3(0,1,0);
        const targetDirection = new THREE.Vector3().addVectors(toLandingSite.multiplyScalar(0.7), upVec.multiplyScalar(0.3)).normalize(); 
    
        const forwardVec = new THREE.Vector3(0,0,1);
        targetQuaternion = new THREE.Quaternion();
        targetQuaternion.setFromUnitVectors(forwardVec, targetDirection);
    


        const initialQuaternion = boosterModel.quaternion;
        threeInitial = new THREE.Quaternion(
            initialQuaternion.x,
            initialQuaternion.y,
            initialQuaternion.z,
            initialQuaternion.w
          );
        
  
        doneBoostback = true;

    }

    if(doneBoostback){
    t = Math.min(t + speed, 1);
    const tempQ = threeInitial.clone();
    tempQ.slerp(targetQuaternion, t);
    boosterBody.quaternion.set(
        tempQ.x,
        tempQ.y,
        tempQ.z,
        tempQ.w
      );
    }

    console.log(t);

    if(t>0.999 && boostbackTime<40){
        console.log("boostback fire");
        boosterBody.applyLocalForce(new CANNON.Vec3(0, 0, 50000), new CANNON.Vec3(0,0,-0.069/2))
        particleSystem.visible = true;
        boostbackTime+=baseTimestep;
    }

   

    if(seperated && boosterAltitude<60){

        if(!getSlerp){
            initial = boosterModel.quaternion;
            getSlerp = true;
        }

        t2 = Math.min(t2 + speed, 1);
        const upDir = new THREE.Quaternion().setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI / 2);
        initial.slerp(upDir, t2);
        boosterBody.quaternion.set(
            initial.x,
            initial.y,
            initial.z,
            initial.w
          );

    }


    if (boosterAltitude<60 && !seperated){
        console.log("upthrust fire");
        boosterThrust = new CANNON.Vec3(0, 10, 70000);
        boosterBody.applyLocalForce(boosterThrust, new CANNON.Vec3(0,0,-0.069/2))
        particleSystem.visible = true;



    } else {
        if(world.constraints.indexOf(c)!=-1){
            // flame.visible = false;
            world.removeConstraint(c);
            console.log("Stage Sep");
            seperated = true;
            // const separationForce = new CANNON.Vec3(0, 0, -10000); // Push booster down
            // boosterBody.applyLocalForce(separationForce, new CANNON.Vec3(0, 0, 0.069 / 2));
            // const shipSeparation = new CANNON.Vec3(0, 0, 10000); // Push ship up
            // shipBody.applyLocalForce(shipSeparation, new CANNON.Vec3(0, 0, -0.046 / 2));
        }



        if (shipAltitude < 200) {
            shipThrust = new CANNON.Vec3(0, 0, 15000);
        } else if (shipAltitude < 400) { 
            shipThrust = new CANNON.Vec3(0, 0, 1000);
        } else if (shipAltitude > 400) {
            shipThrust = new CANNON.Vec3(0, 0, 100);
        }
    
        if (Math.abs(angleToTangent) > 5) {
            const rollThrust = new CANNON.Vec3(0, (angleToTangent)*1 , 0);
            shipThrust.vadd(rollThrust, shipThrust);

        }
    
        if (shipVelocity < 7) {
            const moreThrust = new CANNON.Vec3(0, 0, 100);
            shipThrust.vadd(moreThrust, shipThrust);
        } else if (shipVelocity > 9) {
            shipThrust = new CANNON.Vec3(0, 0, 100);
        }
        shipBody.applyLocalForce(shipThrust, new CANNON.Vec3(0,0,-0.046/2))





    }







    // force is in kg km/s2
    // acceleration in km/s2

    // thrust = new CANNON.Vec3(0, 10, 80000);


    // if (altitude < 80) {    
    //     thrust = new CANNON.Vec3(0, 0, 80000);
    // } else if (altitude < 200) {
    //     thrust = new CANNON.Vec3(0, 0, 250000);
    // } else if (altitude < 400) { 
    //     thrust = new CANNON.Vec3(0, 0, 350000);
    // } else if (altitude > 400) {
    //     thrust = new CANNON.Vec3(0, 0,200000);
    // }

    // if (Math.abs(angleToTangent) > 5) {
    //     const rollThrust = new CANNON.Vec3((angleToTangent) * 0.007, 0, 0);
    //     thrust.vadd(rollThrust, thrust);
    // }

    // if (velocity < 7) {
    //     const moreThrust = new CANNON.Vec3(0, 10000, 0);
    //     thrust.vadd(moreThrust, thrust);
    // } else if (velocity > 9) {
    //     thrust = new CANNON.Vec3(0, 10000, 0);
    // }

    // const thrustPoint = new CANNON.Vec3(0, 0, -0.069/2);
    // // boosterBody.applyLocalForce(thrust, thrustPoint);

    // if(altitude<5){
    //     boosterBody.applyLocalForce(new CANNON.Vec3(0,0,300000), new CANNON.Vec3(0,0,-0.069/2))

    // } else{
    //     if(world.constraints.indexOf(c)!=-1){
    //         world.removeConstraint(c);
    //         console.log("Stage Sep");
    //     }
    // }
    // console.log(boosterBody.force);

    // const boosterUp = new THREE.Vector3(0, 1, 0);
    // boosterUp.applyQuaternion(boosterModel.quaternion);
    // const offset = boosterUp.multiplyScalar(boosterHeight);


        // shipModel.position.copy(boosterBody.position).add(offset);


        // shipModel.position.copy(shipBody.position);//.add(adjusted);
        // console.log("offset", adjusted);
        // const offset = new THREE.Vector3(0, boosterHeight, 0);
        // offset.applyQuaternion(booster.quaternion);
        // ship.position.copy(rocketBody.position)//.add(offset);
    
       
    boosterModel.position.copy(boosterBody.position);//.add(new THREE.Vector3(0,0,0));
    boosterModel.quaternion.copy(boosterBody.quaternion);

    // const boosterUp = new THREE.Vector3(0, 1, 0);
    // boosterUp.applyQuaternion(shipModel.quaternion);
    // const offset = boosterUp.multiplyScalar(0.01);
    // const adjusted = new THREE.Vector3(offset.x, offset.z, offset.y);

    // Assuming shipBody is your Cannon.js body and shipModel is your Three.js mesh


    // Step 1: Define the local offset in Three.js space (Y-up)
    // We want to shift "down" in the model's local Y-axis, so use negative Y
    const localOffset = new THREE.Vector3(0, 0, -0.007); // -0.01 units along local -Y

    // Step 2: Apply the model's quaternion to transform the offset to world space
    const worldOffset = localOffset.clone().applyQuaternion(shipModel.quaternion);

    // Step 3: Sync Three.js model position with Cannon.js body position, then add offset
    shipModel.position.copy(shipBody.position).add(worldOffset);

    // Step 4: Sync quaternion (no change needed here)
    shipModel.quaternion.copy(shipBody.quaternion);
    shipModel.rotation.z += 3.14;







    for (let i = 0; i < particleCount; i += 1) {

        const p = i*3
        if(vertices[p+1]<-0.1){
            vertices[p + 1] = (Math.random() - 1) * 0.05;
        }

        // positions[i] += (Math.random() - 0.5);     // Update x
        vertices[p + 1] -= Math.random() * 0.01; // Update y
        // positions[i + 2] += (Math.random() - 0.5); // Update z

        const c = i*4
        colors[c] = 1; 
        colors[c + 1] = .86; 
        colors[c + 2] = .16; 
        colors[c + 3] = 1;

    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.color.needsUpdate = true;
    particleSystem.position.copy(boosterModel.position);
    particleSystem.quaternion.copy(boosterModel.quaternion);

    const offsetRotation = new THREE.Quaternion();
    offsetRotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    particleSystem.quaternion.multiply(offsetRotation);

    const downrange = boosterModel.position.sub(towerModel.position);


    if (true) {
    
    
    // console.log("Booster Altitude:", boosterAltitude, "km");
    // console.log("Ship Altitude:", shipAltitude, "km");
    // console.log("Velocity:", velocity, "km/s");
    // console.log("Booster Force:", boosterBody.force, "km/s");
    // console.log("Ship Force:", shipBody.force, "km/s");
    // console.log("Angle:", angleToTangent);
    // console.log("Downrange:", downrange, "s");
    // console.log("Time:", time, "s");
    // console.log("Ship Thrust", shipThrust);
    const downrangeDistance = Math.sqrt(downrange.x**2+downrange.z**2).toFixed(2)
    document.getElementById("ship-speed").innerHTML=`${(shipVelocity*3600).toFixed(2)} KM/H`;
    document.getElementById("booster-speed").innerHTML=`${(boosterVelocity*3600).toFixed(2)} KM/H`;

    // document.getElementById("ship-speed").innerHTML=`${(velocity).toFixed(2)} KM/S`;
    // document.getElementById("booster-speed").innerHTML=`${(velocity).toFixed(2)} KM/S`;

    document.getElementById("ship-altitude").innerHTML=`${shipAltitude.toFixed(2)} KM`;
    document.getElementById("booster-altitude").innerHTML=`${boosterAltitude.toFixed(2)} KM`;

    document.getElementById("booster-downrange").innerHTML=`${downrangeDistance} KM`;
    document.getElementById("time").innerHTML=`Time Step ${time.toFixed(0)}`;


    }


 

    if(seperated && boosterAltitude<50){
        console.log("hover fire");

        const velX = boosterBody.velocity.x;
        const velY = boosterBody.velocity.y;
        const velZ = boosterBody.velocity.z;
    
        console.log("vel", velX, velY, velZ);

        const targetAltitude = offsetOfBoosterFromBase;
        const altitudeError = boosterAltitude - targetAltitude;
        const desiredThrust = 30000;
        const thrustP = altitudeError*500
        const thrustD = velY * -20000;
        let thrust = desiredThrust + thrustP + thrustD;

        thrust = Math.max(20000, Math.min(70000, thrust));



        const lateralGain = boosterAltitude > 10 ? 0.1 : 0.5;
        const sideerrx = -downrange.x * lateralGain -  velX * 0.2;
        const sideerrz = -downrange.z * lateralGain -  velZ * 0.2;

        console.log("thrust", velX*10, thrust, velZ*10);

        boosterBody.applyLocalForce(new CANNON.Vec3(0, 0, thrust), new CANNON.Vec3(0,0,-0.069/2))
        boosterBody.applyLocalForce(new CANNON.Vec3(0, 0, 0), new CANNON.Vec3(0,0,0))
        particleSystem.visible = true;
    }

    // frameCount++;


    // camera.rotation.z = Math.PI / 2;
    // controls.update();
    // console.log(ship.position.x, booster.position.x);
    // cannonDebugRenderer.update();      // Update the debug renderer
    
    // earthMesh.layers.set(1); // Earth on layer 1
    // camera.layers.set(1); // Bloom camera sees only layer 1
    // composer.render();
    // camera.layers.set(0); // Main camera sees layer 0 (non-bloom)


    // if(time<5){
    //     cam = allCam[2];
    // } else{
    //     cam = allCam[1];
    // }

    if(cam==allCam[0]){
        camera.position.copy(boosterModel.position).add(new THREE.Vector3(0.2, 0, 0));
        camera.lookAt(boosterModel.position);
    } else if(cam==allCam[1]){
        camera.position.copy(shipModel.position).add(new THREE.Vector3(0.4, 0, 0));
        camera.lookAt(shipModel.position);
        // controls.target.copy(shipModel.position);
        // controls.update();
    } else if(cam==allCam[2]){
        camera.position.copy(towerModel.position).add(new THREE.Vector3(0.1, 0, 0));
        camera.lookAt(boosterModel.position);
    } else if(cam==allCam[3]){
        camera.position.copy(towerModel.position).add(new THREE.Vector3(0.05, 0.2, 0.05));
        camera.lookAt(boosterModel.position);
    }




console.log('hahaha1');

    renderer.render(scene, camera);



}
let frameCount = 0;

renderer.render(scene, camera);


const start = document.getElementById("start");
start.addEventListener("click", function(){
    start.disabled = true;
    animate();

});


// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});