# Setup Instructions for ha_network-connections-card-3d

This custom card depends on external JavaScript libraries (Three.js and OrbitControls) that need to be manually placed in your Home Assistant `/config/www/` folder.

---

## 🔧 Step-by-Step Installation

### 1. Create Folder Structure

Ensure the following folder exists in your Home Assistant config:

```
/config/www/three/
```

> In Home Assistant, `/local/` maps to `/config/www/`.

---

### 2. Download Required JavaScript Files

You need to download the following files and place them in the folder above:

#### ✅ `three.min.js`

Download from:  
[https://unpkg.com/three@0.155.0/build/three.min.js](https://unpkg.com/three@0.155.0/build/three.min.js)

Save to:  
```
/config/www/three/three.min.js
```

#### ✅ `OrbitControls.global.js`

This is the **global** (non-ES6) version of OrbitControls.

Download from:  
[https://cdn.jsdelivr.net/npm/three@0.155.0/examples/js/controls/OrbitControls.js](https://cdn.jsdelivr.net/npm/three@0.155.0/examples/js/controls/OrbitControls.js)

Save to:  
```
/config/www/three/OrbitControls.global.js
```

---

### 3. Restart or Reload Resources

Home Assistant must reload to serve the new files. Do one of the following:

- **Restart Home Assistant**
- Or go to **Developer Tools → YAML → Reload Lovelace**

---

### ✅ Final Check

Open your browser and verify these URLs (replace `<HA_IP>` with your Home Assistant IP or hostname):

- `http://<HA_IP>:8123/local/three/three.min.js`
- `http://<HA_IP>:8123/local/three/OrbitControls.global.js`

If both load, the card should now work properly.

---

## ℹ️ Why This Is Necessary

Home Assistant does not allow automatic installation of arbitrary JS files for security reasons. These must be hosted locally via `/www/`.

---

## 📌 Optional

We may support CDN fallback or auto-bundling in a future version.
