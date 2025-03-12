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
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100000000);
const renderer = new THREE.WebGLRenderer();
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


// const horizonR = 100000; 
// const horizonGeom = new THREE.SphereGeometry(horizonR, 64, 64);
// const horizonTexture = textureLoader.load('horizon.png');
// const horizonMaterial = new THREE.MeshPhongMaterial({
//     map: horizonTexture,
//     side: THREE.DoubleSide,
//     transparent: true,
// });
// const horizon = new THREE.Mesh(horizonGeom, horizonMaterial);
// horizon.position.set(0, 0, 0);
// scene.add(horizon);
// horizon.opacity = 0;

const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true;
// controls.dampingFactor = 0.05;



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
scene.add(axesHelper);


const earthTexture = textureLoader.load('1_earth_8k.jpg');
const earthMaterial = new THREE.MeshPhongMaterial({
    map: earthTexture,
    side: THREE.DoubleSide,
    // emissive: 0xffffff,
    // emissiveIntensity: 2,

})
const earthGeometry = new THREE.SphereGeometry(earthRadius, 128, 128);
const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);

const clouds = textureLoader.load('2k_earth_clouds.jpg');
const cloudMaterial = new THREE.MeshPhongMaterial({
    map: clouds, 
    transparent: true,
    alphaMap: clouds,
    side: THREE.DoubleSide,
    
})
const cloudGeometry = new THREE.SphereGeometry(earthRadius, 128, 128);
const cloudsMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);



earthMesh.position.set(0, -earthRadius, 0);
cloudsMesh.position.set(0,-earthRadius-2.5,0);
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


// const rocketGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 32);
// const rocketMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
// const rocketMesh = new THREE.Mesh(rocketGeometry, rocketMaterial);
// scene.add(rocketMesh);


// const rocketShape = new CANNON.Cylinder(0.01, 0.01, 0.1, 32);
// const rocketBody = new CANNON.Body({
//     mass: 5000e3,
//     position: new CANNON.Vec3(0, 0.02, 0)
// });
// rocketBody.addShape(rocketShape);
// world.addBody(rocketBody);

const boosterShape = new CANNON.Cylinder(0.005, 0.005, 0.069, 32);
const boosterBody = new CANNON.Body({
    mass: 3000e3,
    position: new CANNON.Vec3(0, offsetOfBoosterFromBase+0.069/2, 0)
});
boosterBody.addShape(boosterShape)
world.addBody(boosterBody);


const shipShape = new CANNON.Cylinder(0.005, 0.005, 0.046, 32);
const shipBody = new CANNON.Body({
    mass: 2000e3,
    position: new CANNON.Vec3(0, offsetOfBoosterFromBase+0.069+0.047/2, 0)
});
shipBody.addShape(shipShape);
world.addBody(shipBody);

shipBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
boosterBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);


const c = new CANNON.LockConstraint(boosterBody, shipBody);
world.addConstraint(c);


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

        // camera.position.copy(shipModel.position).add(new THREE.Vector3(0, 0.2, 0.2));
        // camera.lookAt(shipModel.position);
        

    });
});


        camera.position.set(10000,10000,10000);
        camera.lookAt(0,0,0);


let time = 0;
let seperated = false;


function calculateGravitationalForce(body1, body2) {
    const rVec = body1.position.vsub(body2.position); 
    const distance = rVec.norm();
    const gravForceMagnitude = (G * body1.mass * body2.mass) / (distance * distance);
    const gravForce = rVec.unit().scale(-gravForceMagnitude);
    
    return gravForce;
}


function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 10);
    time += 1 / 10;

    // const fastForwardFactor = 10; // Simulate 10x faster
    // const baseTimestep = 1/60; // Stable timestep
    // for (let i = 0; i < fastForwardFactor; i++) {
    // world.step(baseTimestep); // Multiple small steps
    // }


    const gravForceBooster = calculateGravitationalForce(boosterBody, earthBody)
    const magAdjusted = new CANNON.Vec3(gravForceBooster.x, gravForceBooster.z, gravForceBooster.y);
    boosterBody.applyLocalForce(magAdjusted, new CANNON.Vec3(0,0,0));

    const gravForceShip = calculateGravitationalForce(shipBody, earthBody)
    const magAdjusted2 = new CANNON.Vec3(gravForceShip.x, gravForceShip.z, gravForceShip.y);
    shipBody.applyLocalForce(magAdjusted2, new CANNON.Vec3(0,0,0));


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
    const velocity = shipBody.velocity.norm();


    let boosterThrust;
    let shipThrust;


    if ( boosterAltitude<80 && !seperated){

        boosterThrust = new CANNON.Vec3(0, 0, 100000);
        boosterBody.applyLocalForce(boosterThrust, new CANNON.Vec3(0,0,-0.069/2))


    } else {
        if(world.constraints.indexOf(c)!=-1){
            world.removeConstraint(c);
            console.log("Stage Sep");
            seperated = true;
        }



        if (shipAltitude < 200) {
            shipThrust = new CANNON.Vec3(0, 0, 50000);
        } else if (shipAltitude < 400) { 
            shipThrust = new CANNON.Vec3(0, 0, 40000);
        } else if (shipAltitude > 400) {
            shipThrust = new CANNON.Vec3(0, 0, 25000);
        }
    
        if (Math.abs(angleToTangent) > 5) {
            const rollThrust = new CANNON.Vec3(0, (angleToTangent)*0.07 , 0);
            shipThrust.vadd(rollThrust, shipThrust);
            console.log(angleToTangent);
        }
    
        if (velocity < 7) {
            const moreThrust = new CANNON.Vec3(0, 0, 1000);
            shipThrust.vadd(moreThrust, shipThrust);
        } else if (velocity > 9) {
            shipThrust = new CANNON.Vec3(0, 0, 1000);
        }
        console.log("Ship Thrust", shipThrust);
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

        const boosterUp = new THREE.Vector3(0, 1, 0);
        boosterUp.applyQuaternion(shipModel.quaternion);
        const offset = boosterUp.multiplyScalar(0.01);
        const adjusted = new THREE.Vector3(offset.x, offset.y, offset.z);
        shipModel.position.copy(shipBody.position);//.add(adjusted);
        // console.log("offset", adjusted);
        // const offset = new THREE.Vector3(0, boosterHeight, 0);
        // offset.applyQuaternion(booster.quaternion);
        // ship.position.copy(rocketBody.position).add(offset);
    
        // ship.position.copy(rocketBody.position);
        shipModel.quaternion.copy(shipBody.quaternion);


    boosterModel.position.copy(boosterBody.position);//.add(new THREE.Vector3(0,0,0));
    boosterModel.quaternion.copy(boosterBody.quaternion);



    // console.log("Booster Altitude:", boosterAltitude, "km");
    // console.log("Ship Altitude:", shipAltitude, "km");
    // console.log("Velocity:", velocity, "km/s");
    console.log("Booster Force:", boosterBody.force, "km/s");
    // console.log("Ship Force:", shipBody.force, "km/s");
    // console.log("Angle:", angleToTangent);
    // console.log("Downrange:", boosterModel.position.sub(towerModel.position), "s");
    // console.log("Time:", time, "s");


    // camera.position.copy(ship.position).add(new THREE.Vector3(0.3, 0.3, 0));
    camera.position.copy(boosterModel.position).add(new THREE.Vector3(0.3, 0, 0));
    camera.lookAt(boosterModel.position);
    // camera.rotation.z = Math.PI / 2;
    // controls.update();
    // console.log(ship.position.x, booster.position.x);
    cannonDebugRenderer.update();      // Update the debug renderer
    
    // earthMesh.layers.set(1); // Earth on layer 1
    // camera.layers.set(1); // Bloom camera sees only layer 1
    // composer.render();
    // camera.layers.set(0); // Main camera sees layer 0 (non-bloom)
    renderer.render(scene, camera);

}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});