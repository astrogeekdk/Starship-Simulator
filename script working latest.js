import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import * as CANNON from 'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js';



const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.001, 100000000);
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


const earthTexture = textureLoader.load('earth_day.jpg')
const earthMaterial = new THREE.MeshPhongMaterial({
    map: earthTexture,
    side: THREE.DoubleSide,
})
const earthGeometry = new THREE.SphereGeometry(earthRadius, 128, 128);
const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
// console.log("pos", earthMesh.max.y);


earthMesh.position.set(0, -earthRadius, 0);
scene.add(earthMesh);



const earthShape = new CANNON.Sphere(earthRadius);
const earthBody = new CANNON.Body({
    mass: earthMass,
    position: new CANNON.Vec3(0, -earthRadius, 0)
});
earthBody.addShape(earthShape);
earthBody.type = CANNON.Body.STATIC; // Earth doesn't move
world.addBody(earthBody);


earthMesh.rotateX(THREE.MathUtils.degToRad(-63))
earthMesh.rotateY(THREE.MathUtils.degToRad(-9))



// const rocketGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 32);
// const rocketMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
// const rocketMesh = new THREE.Mesh(rocketGeometry, rocketMaterial);
// scene.add(rocketMesh);


const rocketShape = new CANNON.Cylinder(0.01, 0.01, 0.1, 32);
const rocketBody = new CANNON.Body({
    mass: 5000e3,
    position: new CANNON.Vec3(0, 0.02, 0)
});
rocketBody.addShape(rocketShape);
world.addBody(rocketBody);

// const boosterShape = new CANNON.Cylinder(0.01, 0.01, 0.059, 32);
// const boosterBody = new CANNON.Body({
//     mass: 3000e3,
//     position: new CANNON.Vec3(0, 0.02, 0)
// });
// boosterBody.addShape(boosterShape)
// world.addBody(boosterBody);


// const shipShape = new CANNON.Cylinder(0.01, 0.01, 0.044, 32);
// const shipBody = new CANNON.Body({
//     mass: 2000e3,
//     position: new CANNON.Vec3(0, 0.02+0.059, 0)
// });
// shipBody.addShape(shipShape);
// world.addBody(shipBody);



const loader = new GLTFLoader();

let shipModel, boosterModel, towerModel;
let shipHeight, boosterHeight, towerHeight;

loader.load('launchtower.glb', (gltf) => {
    towerModel = gltf.scene;
    towerModel.scale.set(0.003, 0.003, 0.003);
    const towerBox = new THREE.Box3().setFromObject(towerModel);
    boosterHeight = towerBox.max.y - towerBox.min.y;
    console.log("tower height", towerHeight);
    scene.add(towerModel);
});


loader.load('booster.glb', (gltf) => {
    boosterModel = gltf.scene;
    scene.add(boosterModel);

    boosterModel.traverse((child) => {
        if (child.isMesh) {

            const material = child.material;
            // console.log(material); 
            material.roughness = 0.3;
            material.metalness = 0.7;
            material.needsUpdate = true;
        }
    });

    const offsetFromBase = 0.02
    boosterModel.scale.set(0.0045, 0.0045, 0.0045);

    const boosterBox = new THREE.Box3().setFromObject(boosterModel);
    boosterHeight = boosterBox.max.y - boosterBox.min.y;
    boosterModel.position.set(0, offsetFromBase, 0);

    loader.load('ship.glb', (gltf) => {
        shipModel = gltf.scene;
        scene.add(shipModel);

        shipModel.traverse((child) => {
            if (child.isMesh) {
                const material = child.material;
                // console.log(material); 
                material.roughness = 0.3;
                material.metalness = 0.7;
                material.needsUpdate = true;
            }
        });

        shipModel.scale.set(0.0045, 0.0045, 0.0045);
        shipModel.rotation.set(0, Math.PI / 2, 0);

        const shipBox = new THREE.Box3().setFromObject(shipModel);
        let shipHeight = shipBox.max.y - shipBox.min.y;

        console.log("ship height", shipHeight);
        console.log("booster height", boosterHeight);

        shipModel.position.set(0, offsetFromBase + boosterHeight, 0);

        const totalHeight = boosterHeight + shipHeight;
        console.log("total height", totalHeight);

        camera.position.copy(shipModel.position).add(new THREE.Vector3(0, 0.1, 0.1));
        camera.lookAt(shipModel.position);
        

    });
});





let time = 0;

function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 1);

    time += 1 / 1;


    const rVec = rocketBody.position.vsub(earthBody.position); // Vector from Earth to rocket
    const distance = rVec.norm(); // Distance between centers
    const gravForceMagnitude = (G * earthMass * rocketBody.mass) / (distance * distance);
    const gravForce = rVec.unit().scale(-gravForceMagnitude); // Direction toward Earth
    rocketBody.force.vadd(gravForce, rocketBody.force);




    // Compute rocket's forward direction (aligned with cylinder's y-axis)
    const rocketForward = new CANNON.Vec3(0, 1, 0); // Local y-axis
    const worldForward = rocketBody.quaternion.vmult(rocketForward); // Transform to world space

    // Desired tangential direction (perpendicular to rVec)
    const upVec = new CANNON.Vec3(0, 0, 1); // Arbitrary up direction
    const tangentVec = rVec.cross(upVec).unit(); // Perpendicular to rVec

    // Calculate angle between rocket's forward direction and radial vector
    const dotProduct = worldForward.dot(rVec.unit());
    const angleToRadial = Math.acos(dotProduct) * (180 / Math.PI); // Degrees
    const angleToTangent = 90 - angleToRadial; // Angle to desired perpendicular
    // console.log(angleToTangent);



    const altitude = distance - earthRadius
    const velocity = rocketBody.velocity.norm();

    console.log("Altitude:", altitude, "km");
    console.log("Velocity:", velocity, "km/s");
    console.log("Time:", time, "s");




    // force is in kg km/s2
    // acceleration in km/s2

    let thrust;


    if (altitude < 80) {    
        thrust = new CANNON.Vec3(0, 80000, 0);
    } else if (altitude < 200) {
        thrust = new CANNON.Vec3(0, 250000, 0);
    } else if (altitude < 400) {
        thrust = new CANNON.Vec3(0, 350000, 0);
    } else if (altitude > 400) {
        thrust = new CANNON.Vec3(0, 200000, 0);
    }

    if (Math.abs(angleToTangent) > 5) {
        const rollThrust = new CANNON.Vec3((angleToTangent) * 0.007, 0, 0);
        thrust.vadd(rollThrust, thrust);
    }

    if (velocity < 7) {
        const moreThrust = new CANNON.Vec3(0, 10000, 0);
        thrust.vadd(moreThrust, thrust);
    } else if (velocity > 9) {
        thrust = new CANNON.Vec3(0, 10000, 0);
    }

    const thrustPoint = new CANNON.Vec3(0, -0.05, 0);
    rocketBody.applyLocalForce(thrust, thrustPoint);


    const boosterUp = new THREE.Vector3(0, 1, 0);
    boosterUp.applyQuaternion(boosterModel.quaternion);
    const offset = boosterUp.multiplyScalar(boosterHeight);


        shipModel.position.copy(rocketBody.position).add(offset);

        // const offset = new THREE.Vector3(0, boosterHeight, 0);
        // offset.applyQuaternion(booster.quaternion);
        // ship.position.copy(rocketBody.position).add(offset);
    
        // ship.position.copy(rocketBody.position);
        shipModel.quaternion.copy(rocketBody.quaternion);


    boosterModel.position.copy(rocketBody.position);
    boosterModel.quaternion.copy(rocketBody.quaternion);

    // camera.position.copy(ship.position).add(new THREE.Vector3(0.3, 0.3, 0));
    camera.position.copy(boosterModel.position).add(new THREE.Vector3(0, 0, 0.3));
    camera.lookAt(boosterModel.position);
    // camera.rotation.z = Math.PI / 2;

    // console.log(ship.position.x, booster.position.x);

    renderer.render(scene, camera);

}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});