import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import * as CANNON from 'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js';



const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('container').appendChild(renderer.domElement);

const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;
controls.dampingFactor = 0.05;

const world = new CANNON.World();
world.gravity.set(0, 0, 0); 


const rocketGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 32);
const rocketMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const rocketMesh = new THREE.Mesh(rocketGeometry, rocketMaterial);
scene.add(rocketMesh);


const rocketShape = new CANNON.Cylinder(0.01, 0.01, 0.1, 32);
const rocketBody = new CANNON.Body({
    mass: 5000e3,
    position: new CANNON.Vec3(0, 1, 0)
});
rocketBody.addShape(rocketShape);
world.addBody(rocketBody);


const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);


const earthRadius = 6371; 
const earthMass = 5.972e24; 
const G = 6.6743e-20;

const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load('earth_day.jpg')
const earthMaterial = new THREE.MeshPhongMaterial({
    map: earthTexture,
    side: THREE.DoubleSide,
})
const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);

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



camera.position.copy(rocketMesh.position).add(new THREE.Vector3(0, 0.2, 0.2));
camera.lookAt(rocketMesh.position);


let time = 0;

function animate() {
    requestAnimationFrame(animate);

    world.step(1/1);

    time += 1/1;

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
    console.log(angleToTangent);
    // // Roll until perpendicular
    // if (time > 50 && Math.abs(angleToTangent) > 5) { // Start rolling after 50s, stop near 90°
    //     const rollTorque = new CANNON.Vec3(0, 0, 5000); // Torque around z-axis (adjust magnitude)
    //     rocketBody.torque.vadd(rollTorque, rocketBody.torque);
    // }



    const altitude = distance - earthRadius
    const velocity = rocketBody.velocity.norm();

    console.log("Altitude:", altitude, "km");
    console.log("Velocity:", velocity, "km/s");
    console.log("Time:", time, "s");

    // force is in kg km/s2
    // acceleration in km/s2

    let thrust;


    // if (time>100 && Math.abs(angleToTangent) > 5 ){
    //     thrust = new CANNON.Vec3( (angleToTangent)*0.007 , 100000,0);
    // } 
    // // else if (time > 100) {
    // //     thrust = new CANNON.Vec3(0,150000,0);
    // // } 
    // else if (time>200) {
    //     thrust = new CANNON.Vec3(0, 300000,0);
    // } else if (time>0) {
    //     thrust = new CANNON.Vec3(0, 80000,0);
    // }

    // if (time>0 && time<150){
    //     thrust = new CANNON.Vec3(0,80000,0);
    // } else if (time>100 && time < 250 && Math.abs(angleToTangent)>5){
    //     thrust = new CANNON.Vec3( (angleToTangent)*0.007 , 100000,0);
    // } else if (time > 250 && Math.abs(angleToTangent)>5){
    //     thrust = new CANNON.Vec3( (angleToTangent)*0.007 , 200000,0);
    // } else {
    //     thrust = new CANNON.Vec3( 0 , 350000,0);
    // }

    if (altitude < 80){
        thrust = new CANNON.Vec3(0,80000,0);
    } else if (altitude < 200) {
        thrust = new CANNON.Vec3( 0 , 250000,0);
    } else if (altitude < 400) {
        thrust = new CANNON.Vec3( 0 , 350000,0);
    } else if (altitude > 400) {
        thrust = new CANNON.Vec3( 0 , 200000,0);
    }

    if (Math.abs(angleToTangent)>5){
        const rollThrust = new CANNON.Vec3((angleToTangent)*0.007, 0, 0);
        thrust.vadd(rollThrust, thrust);
    }

    if (velocity<7){
        const moreThrust = new CANNON.Vec3(0, 10000, 0);
        thrust.vadd(moreThrust, thrust);
    } else if (velocity>9){
        thrust = new CANNON.Vec3( 0 , 10000 ,0);
    }
    
    const thrustPoint = new CANNON.Vec3(0,-0.05,0);
    rocketBody.applyLocalForce(thrust, thrustPoint);


    rocketMesh.position.copy(rocketBody.position);
    rocketMesh.quaternion.copy(rocketBody.quaternion);

    camera.position.copy(rocketMesh.position).add(new THREE.Vector3(0, 0, 1));
    camera.lookAt(rocketMesh.position);

  
    renderer.render(scene, camera);

}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});