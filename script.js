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

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
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


// const rocketShape = new CANNON.Cylinder(0.01, 0.01, 0.1, 32);
// const rocketBody = new CANNON.Body({
//     mass: 5000e3,
//     position: new CANNON.Vec3(0, 1, 0)
// });
// rocketBody.addShape(rocketShape);
// world.addBody(rocketBody);

const starshipShape = new CANNON.Cylinder(0.01, 0.01, 0.1, 32);
const rocketBody = new CANNON.Body({
    mass: 5000e3,
    position: new CANNON.Vec3(0, 0.025, 0)
});
rocketBody.addShape(starshipShape)
world.addBody(rocketBody);

const loader = new GLTFLoader();


let ship, booster, tower;
let boosterHeight;

loader.load('launchtower.glb', (gltf) => {
    tower = gltf.scene;
    tower.scale.set(0.0035, 0.0035, 0.0035);
    const box = new THREE.Box3().setFromObject(tower);
    console.log("tower height", box.max.y - box.min.y);
    scene.add(tower);

    // tower.position.set(0,-1,0);
});

// const debugLine = new THREE.ArrowHelper(offset.normalize(), booster.position, 5, 0xffff00);
// scene.add(debugLine);

loader.load('booster.glb', (gltf) => {
    booster = gltf.scene;
    scene.add(booster);


    booster.traverse((child) => {
        if (child.isMesh) {

            const material = child.material;
            // console.log(material); 
            material.roughness = 0.3; // Less rough (smoother surface)
            material.metalness = 0.7; // More metallic look
            material.needsUpdate = true;
        }
    });

    const offsetFromBase = 0.025
    booster.scale.set(0.005, 0.005, 0.005);

    const box = new THREE.Box3().setFromObject(booster);
    boosterHeight = box.max.y - box.min.y;
    booster.position.set(0, offsetFromBase, 0);

    loader.load('ship.glb', (gltf) => {
        ship = gltf.scene;


        ship.traverse((child) => {
            if (child.isMesh) {

                const material = child.material;
                // console.log(material); 
                material.roughness = 0.3; // Less rough (smoother surface)
                material.metalness = 0.7; // More metallic look
                material.needsUpdate = true;
            }
        });


        scene.add(ship);

        ship.scale.set(0.005, 0.005, 0.005);
        ship.rotation.set(0, Math.PI / 2, 0);

        const shipBox = new THREE.Box3().setFromObject(ship);
        let shipHeight = shipBox.max.y - shipBox.min.y;

        console.log("ship height", shipHeight);
        console.log("booster height", boosterHeight);

        ship.position.set(0, offsetFromBase + boosterHeight, 0);

        const totalHeight = boosterHeight + shipHeight;
        console.log("total height", totalHeight);


        camera.position.copy(ship.position).add(new THREE.Vector3(0, 0.1, 0.1));
        camera.lookAt(ship.position);


    });
});










let time = 0;

function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 1);

    time += 1 / 1;

    // booster.visible = false;
    // Calculate gravitational force
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

    // console.log("Altitude:", altitude, "km");
    // console.log("Velocity:", velocity, "km/s");
    // console.log("Time:", time, "s");


    // horizonMaterial.opacity = 0; //THREE.MathUtils.clamp(1.0 - (altitude / 100.0), 0.0, 1.0);


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

    const thrustPoint = new CANNON.Vec3(0, -0.033, 0);
    rocketBody.applyLocalForce(thrust, thrustPoint);


    const offset = new THREE.Vector3(0, boosterHeight, 0);
    offset.applyQuaternion(booster.quaternion);
    const newPosition = booster.position.clone().add(offset);


    ship.position.copy(newPosition);
    ship.quaternion.copy(rocketBody.quaternion);

    booster.position.copy(rocketBody.position);
    booster.quaternion.copy(rocketBody.quaternion);

    // camera.position.copy(ship.position).add(new THREE.Vector3(0.3, 0.3, 0));
    camera.position.copy(booster.position).add(new THREE.Vector3(-0.1, 0.1, 0.1));
    camera.lookAt(booster.position);
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