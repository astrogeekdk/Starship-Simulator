import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


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
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 10000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('container').appendChild(renderer.domElement);

const controls = new OrbitControls( camera, renderer.domElement );

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const world = new CANNON.World();
// world.gravity.set(0, -10, 0);


var cannonDebugRenderer = new CannonDebugRenderer( scene, world );


const radii = 6371;
const sphereGeo = new THREE. SphereGeometry (radii, 128, 128);
const sphereMat = new THREE.MeshStandardMaterial({
color: 0x00ff00,
// metalness: 0, roughness: 1
}) ;
const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
scene.add(sphereMesh);
sphereMesh.position.set(0,-radii,0)
const sphereBody = new CANNON.Body({
    mass: 10,
    shape: new CANNON. Sphere (radii),
    position: new CANNON.Vec3(0,-radii,0),
});
world.addBody(sphereBody);


const booster = new THREE.CylinderGeometry(0.005, 0.005, 0.07, 32);
booster.rotateX(Math.PI/2);
const boosterMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff });
const boosterMesh = new THREE.Mesh(booster, boosterMaterial);
boosterMesh.position.set(0,0.1+0.07/2,0);
scene.add(boosterMesh);


const boosterBody = new CANNON.Body({
    mass: 2000e3,
    shape: new CANNON.Cylinder(0.005, 0.005, 0.07, 32)
    
});
boosterBody.position.set(0, 0.07/2, 0);
world.addBody(boosterBody);

boosterBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);


const ship = new THREE.CylinderGeometry(0.005, 0.005, 0.05, 32);
ship.rotateX(Math.PI/2);
const shipMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const shipMesh = new THREE.Mesh(ship, shipMaterial);
shipMesh.position.set(0,0.07+0.05/2,0);
scene.add(shipMesh);

const shipBody = new CANNON.Body({
    mass: 2000e3,
    shape: new CANNON.Cylinder(0.005, 0.005, 0.05, 32)
});
shipBody.position.set(0,0.07+0.05/2,0);
world.addBody(shipBody);

shipBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

const c = new CANNON.LockConstraint(boosterBody, shipBody);
world.addConstraint(c);


const axesHelper = new THREE.AxesHelper(100); 
        scene.add(axesHelper);

        
camera.position.set(0.3,0.3,0.3);
camera.lookAt(0, 0, 0);
// controls.update();

const speed = 0.1;
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'ArrowUp':
            shipBody.position.y -= speed;
            break;
        case 'ArrowDown':
            shipBody.position.y += speed;
            break;
        case 'ArrowLeft':
            shipBody.position.x -= speed;
            break;
        case 'ArrowRight':
            shipBody.position.x += speed;
            break;
    }
});


let time = 0    
// Animation loop
function animate() {
    
    world.step(1/30); // 60 FPS
    
    time += 1/30
    
    // planeMesh.position.copy(planeBody.position); 
    // planeMesh.quaternion.copy(planeBody.quaternion);


    // sphereMesh.position.copy(sphereBody.position);
    // sphereMesh.quaternion.copy(sphereBody.quaternion);




    
    boosterMesh.position.copy(boosterBody.position);
    boosterMesh.quaternion.copy(boosterBody.quaternion);

    
    shipMesh.position.copy(shipBody.position);
    shipMesh.quaternion.copy(shipBody.quaternion);

    

    if(time>0 && time <10){
        boosterBody.applyLocalForce(new CANNON.Vec3(0,1000,80000), new CANNON.Vec3(0,0,-0.07/2))
    }

    if (time>10){
        if(world.constraints.indexOf(c)!=-1){
        world.removeConstraint(c);
        console.log("Stage Sep");}
    }
    console.log(time);

    camera.position.copy(boosterMesh.position).add(new THREE.Vector3(0.3,0, 0));
    camera.lookAt(boosterMesh.position);
    // controls.update();

    cannonDebugRenderer.update();      // Update the debug renderer

    renderer.render(scene, camera);
    requestAnimationFrame(animate);

}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});