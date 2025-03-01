class NetworkConnectionsCard3D extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.firstLoad = Date.now();
    this.hubId = "Host"
    // Maps to track nodes and labels
    this.loadedConnections = new Map();
    this.loadedPorts = new Map();
    this.loadedIps = new Map();
    this.loadedLabels = new Map();
    this.THREE = null;
    this.sceneInitialized = false;
  }

  setConfig(config) {
    if (!config.entity) throw new Error("You need to define an entity");
    this.config = config;
    this.hubId = config.hubId || "Host";
  }

  connectedCallback() { 
    this._loadScripts(); 
  }

  async _loadScripts() {
    await this._loadScript("/local/three/three.min.js");
    if (!window.THREE) return console.error("THREE.js failed to load.");
    this.THREE = window.THREE;
    await this._loadScript("/local/three/OrbitControls.global.js");
    if (!window.THREE.OrbitControls) return console.error("OrbitControls failed to load.");
    this._initScene();
    this.sceneInitialized = true;
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => {
        console.error(`Error loading ${src}`);
        reject();
      };
      document.head.appendChild(script);
    });
  }

  _initScene() {
    if (!this.THREE || !window.THREE.OrbitControls) 
      return console.error("THREE.js or OrbitControls not loaded.");
      
    this.scene = new this.THREE.Scene();
    this.scene.background = null;

    this.camera = new this.THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    this.camera.position.set(0, 5, 90);

    this.renderer = new this.THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.shadowRoot.innerHTML = `
      <div id="container"></div>
      <div id="labels-container" style="position:absolute; top:0; left:0;"></div>
    `;
    this.shadowRoot.querySelector('#container').appendChild(this.renderer.domElement);

    this.controls = new window.THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.3;

    this.scene.add(new this.THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new this.THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
    
    // Create the hub node.
    this.hubNode = new this.THREE.Mesh(
      new this.THREE.SphereGeometry(1.5, 32, 32),
      new this.THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    this.hubNode.position.set(0, 0, 0);
    this.hubNode.name = "Hub";
    this.scene.add(this.hubNode);
    this._addLabel('Hub', this.hubNode);
    this._updateLabels();

    this.animate();
  }

  // Updated _addRelationLine: returns the created line so it can be tracked.
  _addRelationLine(start, end) {
    if (!(start instanceof this.THREE.Vector3) || !(end instanceof this.THREE.Vector3)) {
      console.error("Invalid points provided for relation line.");
      return;
    }
    const material = new this.THREE.LineBasicMaterial({ color: 0x808080 });
    const geometry = new this.THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new this.THREE.Line(geometry, material);
    this.scene.add(line);
    return line;
  }

  _addLabel(text, node) {
    // Check if a label for this node already exists.
    if (this.loadedLabels.has(node.name)) {
      const { label } = this.loadedLabels.get(node.name);
      label.textContent = text;
      return;
    }
    const label = document.createElement("div");
    label.className = "label";
    label.style.position = "absolute";
    label.style.color = "gray";
    label.style.padding = "2px 5px";
    label.style.borderRadius = "3px";
    label.style.whiteSpace = "nowrap";
    // Disable pointer events so the labels don't block interactions
    label.style.pointerEvents = "none";
    label.textContent = text;
    this.shadowRoot.querySelector("#labels-container").appendChild(label);
    this.loadedLabels.set(node.name, { label, node });
  }

  // Updated _updateLabels() with dynamic font sizing for far nodes.
  _updateLabels() {
    // Get the hub's screen position to serve as the origin for our offsets.
    const hubScreen = this._toScreenPosition(this.hubNode.position);
    
    this.loadedLabels.forEach(({ label, node }) => {
      if (!node) return;
      
      // Get the node's current screen position.
      const screenPos = this._toScreenPosition(node.position);
      
      let offsetX = 0, offsetY = 0;
      
      if (node.name !== "Hub") {
        // Calculate the direction from the hub to this node in screen space.
        const dx = screenPos.x - hubScreen.x;
        const dy = screenPos.y - hubScreen.y;
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        
        if (magnitude > 0) {
          // Use a fixed pixel offset in the direction of the node's displacement.
          const offsetMagnitude = 10; // Adjust this value as needed.
          offsetX = (dx / magnitude) * offsetMagnitude;
          offsetY = (dy / magnitude) * offsetMagnitude;
        }
      } else {
        // Optionally, position the hub's label differently (for example, slightly above).
        offsetY = -20;
      }
      
      // Compute the distance from the node to the camera.
      const distance = node.position.distanceTo(this.camera.position);
      
      // Define near and far distances for scaling.
      const near = 20, far = 100;
      // Clamp the interpolation factor between 0 and 1.
      const t = this.THREE.MathUtils.clamp((distance - near) / (far - near), 0, 1);
      
      // Define maximum and minimum font sizes.
      const maxFontSize = 16; // For nodes close to the camera.
      const minFontSize = 4;  // For nodes far from the camera (very small)
      // Linearly interpolate the font size.
      const fontSize = (1 - t) * maxFontSize + t * minFontSize;
      
      // Apply the computed font size and update the label's position.
      label.style.fontSize = `${fontSize}px`;
      label.style.transform = `translate(${screenPos.x + offsetX}px, ${screenPos.y + offsetY}px)`;
    });
  }

  _toScreenPosition(position) {
    const vector = position.clone().project(this.camera);
    return {
      x: (vector.x * 0.5 + 0.5) * window.innerWidth - 20,
      y: (-vector.y * 0.5 + 0.5) * window.innerHeight - 10
    };
  }

  _removeLabelsNotInSet(activeKeys) {
    // Remove labels whose keys are no longer in the active set.
    this.loadedLabels.forEach((_, key) => {
      if (!activeKeys.has(key)) {
        const { label } = this.loadedLabels.get(key);
        label.remove();
        this.loadedLabels.delete(key);
      }
    });
  }

  set hass(hass) {
    if (!this.config?.entity || !this.sceneInitialized || !hass?.states) return;
    const connections = hass.states[this.config.entity]?.attributes?.connections;
    if (!connections) return;
    // Update the 3D graph based on current connection data.
    this._updateGraph(connections);
    this._updateLabels();
  }

  _updateGraph(connections) {
    // Build a set of current label keys.
    const newLabels = new Set();
    
    // Get unique ports from connections.
    const ports = Array.from(new Set(connections.map((c) => c.port)));
    ports.forEach((port, index) => {
      if (!this.loadedPorts.has(port)) {
        this._addPort(port, index, ports.length);
      }
      newLabels.add(`port-${port}`);
    });
    
    // Remove ports that are no longer active.
    this.loadedPorts.forEach((node, port) => {
      if (!ports.includes(port)) {
        // Remove the related parent line if it exists.
        if (node.parentLine) {
          this.scene.remove(node.parentLine);
        }
        // Also remove any IP nodes that were connected to this port.
        this.loadedIps.forEach((ipNode, ipKey) => {
          if (ipNode.parentPort === port) {
            if (ipNode.parentLine) {
              this.scene.remove(ipNode.parentLine);
            }
            this.scene.remove(ipNode);
            this.loadedIps.delete(ipKey);
            if (this.loadedLabels.has(ipKey)) {
              const { label } = this.loadedLabels.get(ipKey);
              label.remove();
              this.loadedLabels.delete(ipKey);
            }
          }
        });
        this.scene.remove(node);
        this.loadedPorts.delete(port);
        if (this.loadedLabels.has(`port-${port}`)) {
          const { label } = this.loadedLabels.get(`port-${port}`);
          label.remove();
          this.loadedLabels.delete(`port-${port}`);
        }
      }
    });
    
    // Process IP connections.
    const newIps = new Map();
    connections.forEach(({ port, target }) => {   
      const ipKey = `ip-${target}`;
      if (!this.loadedIps.has(ipKey)) {
        this._addIp(port, target);
      }
      newIps.set(ipKey, true);
      newLabels.add(ipKey);
    });
    
    // Remove IP nodes that are no longer active.
    this.loadedIps.forEach((ipNode, key) => {
      if (!newIps.has(key)) {
        // Remove the related parent line if it exists.
        if (ipNode.parentLine) {
          this.scene.remove(ipNode.parentLine);
        }
        this.scene.remove(ipNode);
        this.loadedIps.delete(key);
        if (this.loadedLabels.has(key)) {
          const { label } = this.loadedLabels.get(key);
          label.remove();
          this.loadedLabels.delete(key);
        }
      }
    });
    
    // Remove labels that are not in the new labels set.
    this._removeLabelsNotInSet(newLabels);
  }

  _addPort(port, index, totalPorts) {
    // Position the port node around a sphere using the golden angle.
    const sphereRadius = 35 + Math.random() * 15; // Randomized length
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const y = 1 - (index / (totalPorts - 1)) * 2;
    const radius = Math.sqrt(1 - y * y) * sphereRadius;
    const theta = goldenAngle * index;
    const position = new this.THREE.Vector3(
      Math.cos(theta) * radius,
      y * sphereRadius,
      Math.sin(theta) * radius
    );

    const portNode = new this.THREE.Mesh(
      new this.THREE.SphereGeometry(0.6, 16, 16),
      new this.THREE.MeshStandardMaterial({ color: 0xff5733 })
    );
    portNode.position.copy(position);
    portNode.name = `port-${port}`;
    this.scene.add(portNode);
    this.loadedPorts.set(port, portNode);

    // Add label and the relation line (from the hub to the port).
    this._addLabel(`Port ${port}`, portNode);
    const line = this._addRelationLine(this.hubNode.position, position);
    portNode.parentLine = line;
  }

  _checkCollision(position, existingNodes, minDistance) {
    for (let node of existingNodes) {
      if (node && node.position && node.position.distanceTo(position) < minDistance) {
        return true;
      }
    }
    return false;
  }

  _addIp(port, target) {
    const portNode = this.loadedPorts.get(port);
    if (!portNode) return;

    const bloomRadius = 8;
    let position;
    let attempts = 0;
    do {
      position = portNode.position.clone().add(new this.THREE.Vector3(
        bloomRadius * (Math.random() - 0.5),
        bloomRadius * (Math.random() - 0.5),
        bloomRadius * (Math.random() - 0.5)
      ));
      attempts++;
    } while (this._checkCollision(position, Array.from(this.loadedIps.values()), 0.8) && attempts < 10);

    const ipNode = new this.THREE.Mesh(
      new this.THREE.SphereGeometry(0.4, 16, 16),
      new this.THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    ipNode.position.copy(position);
    ipNode.name = `ip-${target}`;
    // Track which port this IP is connected to.
    ipNode.parentPort = port;
    this.scene.add(ipNode);
    this.loadedIps.set(`ip-${target}`, ipNode);

    // Attach the IP label to the node and add its relation line (from port to IP).
    this._addLabel(target, ipNode);
    const line = this._addRelationLine(portNode.position, position);
    ipNode.parentLine = line;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this._updateLabels();
  }
}

customElements.define("network-connections-card-3d", NetworkConnectionsCard3D);
