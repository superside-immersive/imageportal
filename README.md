# Portal Tracker

Proyecto migrado para concentrarse en una sola experiencia principal: **portal por image target** usando **A-Frame + 8th Wall standalone runtime**.

La escena ya no depende del scene graph `.expanse.json` para el runtime principal. Ahora la app vive en una `a-scene` real, para que puedas abrir el **inspector de A-Frame** y editar la jerarquía de entidades directamente.

---

## Qué hace ahora

- Usa el image target **poster2**.
- Cuando el target se detecta, ancla un portal con contenido 3D detrás.
- En desktop abre un **preview 3D navegable** para inspección y edición.
- El inspector de A-Frame queda disponible con **ctrl + alt + i**.

---

## Run

```bash
npm install
npm run dev
```

Build de producción:

```bash
npm run build
```

---

## Flujo de uso

### Mobile

1. Abrí la experiencia desde un navegador compatible.
2. Permití acceso a cámara.
3. Apuntá al target **poster2**.
4. El portal se ancla a la imagen detectada.

### Desktop

1. Abrí la experiencia en el navegador.
2. Si no hay sesión AR real, se activa el **preview desktop 3D**.
3. Navegá la escena para revisar composición, escala y portal.
4. Abrí el inspector de A-Frame con **ctrl + alt + i**.

> Desktop está pensado como **preview e inspección**. No garantiza tracking real por webcam en todos los navegadores.

---

## Target activo

- JSON: `image-targets copy/poster2.json`
- Thumbnail servida en runtime: `dist/image-targets/poster2_thumbnail.png`

---

## Estado de la migración

Hecho en esta etapa:

- runtime principal simplificado a una escena A-Frame
- image tracking concentrado en `poster2`
- portal basado en hiders + ancla por target
- soporte de desktop preview con `allowedDevices: any`
- eliminación del build path de editor y del runtime virtual de ECS del entry principal

Pendiente para limpieza posterior:

- borrar assets y demos legacy que ya no se usen
- retirar código ECS sobrante
- retirar archivos de editor/scene graph si dejan de ser necesarios

---

## Referencia visual

La mecánica del portal toma como referencia el ejemplo `portal` de 8th Wall, pero se adaptó a un flujo de **image target** y a un runtime local con **A-Frame**.
