<script setup lang="ts">
/**
 * Marca de Bemo MED: la "B" blanca sobre un cuadrado teal de esquinas suaves.
 *
 * Misma construcción que el isotipo de Bemo INMO —es la marca del grupo— pero
 * con el color de MED. Allá el cuadrado es naranja porque ese es su color de
 * firma; acá es el teal de `DESIGN.md`, que además es el acento de la interfaz:
 * en un producto de salud la marca y la UI hablan del mismo tono de confianza y
 * no hace falta separarlas.
 *
 * La B es un path trazado, no una fuente: así se lee igual a 16px en la pestaña
 * del navegador que a 64px en la portada, sin depender de que General Sans haya
 * terminado de cargar.
 */
withDefaults(
  defineProps<{
    tam?: number;
    /** Muestra "Bemo MED" al lado del isotipo. */
    conNombre?: boolean;
    /** Para fondos oscuros: el wordmark pasa a blanco. */
    invertido?: boolean;
  }>(),
  { tam: 32, conNombre: false, invertido: false },
);
</script>

<template>
  <span class="bemo-logo" :class="{ invertido }">
    <svg
      :width="tam"
      :height="tam"
      viewBox="0 0 40 40"
      role="img"
      aria-label="Bemo MED"
      class="marca"
    >
      <rect width="40" height="40" rx="10" fill="var(--teal)" />
      <!-- Dos panzas sobre el mismo eje, con contragrafismos generosos para que
           la letra no se cierre en tamaños chicos. -->
      <path
        d="M13.4 10.2h8.05c2.32 0 4.12.5 5.38 1.5 1.27 1 1.9 2.4 1.9 4.2 0 1.2-.3 2.22-.9 3.06-.6.83-1.44 1.43-2.5 1.8v.12c1.32.3 2.34.92 3.05 1.86.72.94 1.08 2.1 1.08 3.5 0 1.94-.68 3.45-2.03 4.53-1.35 1.08-3.25 1.62-5.7 1.62H13.4V10.2Zm4.36 8.94h3.3c1.06 0 1.88-.24 2.45-.72.58-.48.87-1.16.87-2.04 0-.88-.3-1.55-.87-2-.57-.46-1.4-.7-2.46-.7h-3.29v5.46Zm0 9.66h3.75c1.15 0 2.04-.26 2.66-.79.63-.53.94-1.28.94-2.25s-.31-1.72-.94-2.25c-.62-.53-1.51-.8-2.66-.8h-3.75v6.09Z"
        fill="var(--on-accent)"
      />
    </svg>

    <span v-if="conNombre" class="nombre">
      Bemo<span class="vertical">MED</span>
    </span>
  </span>
</template>

<style scoped>
.bemo-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--s-sm);
}
.marca {
  display: block;
  flex: none;
}
.nombre {
  font-family: 'General Sans', sans-serif;
  font-weight: 600;
  font-size: 18px;
  color: var(--ink);
  letter-spacing: -0.01em;
  white-space: nowrap;
}
/* `--teal-ink` y no `--teal`: como texto chico, el teal del isotipo queda por
   debajo de AA sobre fondo claro. `--teal-ink` es la variante pensada para
   texto y ya está resuelta en los dos temas. */
.vertical {
  font-family: 'Geist', sans-serif;
  font-weight: 500;
  font-size: 0.78em;
  letter-spacing: 0.06em;
  color: var(--teal-ink);
  margin-left: 0.4em;
  vertical-align: 1px;
}
.invertido .nombre { color: #fff; }
.invertido .vertical { color: var(--lp-sobre-tinta-accent, #4fa9b1); }
</style>
