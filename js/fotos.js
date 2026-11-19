/* Fotos en IndexedDB (no caben en localStorage). Se comprimen a ~1280 px JPEG. */
(function (root) {
  'use strict';
  let dbProm = null;
  function db() {
    if (!dbProm) dbProm = new Promise((ok, mal) => {
      const r = indexedDB.open('jcc-fotos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fotos');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    return dbProm;
  }
  async function op(modo, fn) {
    const d = await db();
    return new Promise((ok, mal) => {
      const tx = d.transaction('fotos', modo);
      const req = fn(tx.objectStore('fotos'));
      tx.oncomplete = () => ok(req && req.result);
      tx.onerror = () => mal(tx.error);
    });
  }

  function comprimir(archivo, lado, calidad) {
    return new Promise((ok, mal) => {
      const img = new Image();
      const url = URL.createObjectURL(archivo);
      img.onload = () => {
        const k = Math.min(1, (lado || 1280) / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo comprimir'))), 'image/jpeg', calidad || 0.7);
      };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('Imagen no válida')); };
      img.src = url;
    });
  }

  const Fotos = {
    async guardar(archivo) {
      const blob = await comprimir(archivo);
      const id = Store.uid();
      await op('readwrite', (s) => s.put(blob, id));
      return id;
    },
    obtener: (id) => op('readonly', (s) => s.get(id)),
    borrar: (id) => op('readwrite', (s) => s.delete(id)),
    // Pone la foto en un <img> en cuanto está disponible.
    pintar(img, id) {
      Fotos.obtener(id).then((b) => { if (b) img.src = URL.createObjectURL(b); }).catch(() => {});
      return img;
    },
    // Para respaldos: todas las fotos como dataURL.
    async exportar(ids) {
      const out = {};
      for (const id of ids) {
        const b = await Fotos.obtener(id);
        if (b) out[id] = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
      }
      return out;
    },
    async importar(mapa) {
      for (const [id, url] of Object.entries(mapa || {})) {
        const b = await (await fetch(url)).blob();
        await op('readwrite', (s) => s.put(b, id));
      }
    },
  };
  root.Fotos = Fotos;
})(window);
