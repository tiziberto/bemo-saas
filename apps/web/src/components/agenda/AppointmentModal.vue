<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, errMessage } from '../../lib/api';
import { APPOINTMENT_STATUS, capitalize, fmtDayLong, fmtTime, fullName, haceCuanto, waLink } from '../../lib/format';
import { useAuth } from '../../stores/auth';
import { useUi } from '../../stores/ui';
import type { Appointment, Professional, Room } from '../../lib/types';
import StatusChip from '../ui/StatusChip.vue';
import UiIcon from '../ui/UiIcon.vue';
import UiModal from '../ui/UiModal.vue';

const props = defineProps<{
  appt: Appointment;
  professionals: Professional[];
  rooms: Room[];
}>();
const emit = defineEmits<{ close: []; updated: [] }>();

const auth = useAuth();
const ui = useUi();
const router = useRouter();

/**
 * Cuánto lleva esperando. Se recalcula cada 30 s: un número que dice "hace 5 min"
 * y se queda quieto diez minutos es peor que no mostrarlo.
 */
const ahora = ref(Date.now());
let reloj: ReturnType<typeof setInterval> | null = null;
onMounted(() => { reloj = setInterval(() => (ahora.value = Date.now()), 30_000); });
onBeforeUnmount(() => { if (reloj) clearInterval(reloj); });

const esperaTexto = computed(() => {
  const a = props.appt.arrived_at;
  if (!a) return '';
  // Ya pasó: la espera queda congelada en lo que efectivamente esperó.
  if (props.appt.called_at) {
    const min = Math.round(
      (new Date(props.appt.called_at).getTime() - new Date(a).getTime()) / 60000,
    );
    return `Esperó ${min} min`;
  }
  return `Esperando ${haceCuanto(a, ahora.value).replace('hace ', '')}`;
});
const busy = ref('');

const canEdit = computed(() => auth.isAdmin || auth.isReceptionist);
const prof = computed(
  () => props.professionals.find((p) => p.id === props.appt.professional_id)?.full_name ?? '—',
);
const room = computed(
  () => props.rooms.find((r) => r.id === props.appt.room_id)?.name ?? 'Sin asignar',
);
const wa = computed(() => waLink(props.appt.phone));

// Sólo mostramos las transiciones que tienen sentido desde el estado actual.
const actions = computed(() => {
  const s = props.appt.status;
  const all = [
    // `primary` = lo que se espera hacer desde ese estado. Con cinco botones grises
    // iguales no se distinguía la acción del día del resto.
    { status: 'confirmed', label: 'Confirmar', icon: 'check-circle', show: s === 'scheduled', primary: false },
    // Recepción marca que llegó; el profesional lo llama a pasar. Entre esas dos
    // marcas es lo que el paciente esperó de verdad.
    { status: 'waiting', label: 'Llegó', icon: 'user', show: s === 'scheduled' || s === 'confirmed', primary: true },
    { status: 'in_progress', label: 'Atender', icon: 'check-circle', show: s === 'waiting', primary: true },
    { status: 'completed', label: 'Marcar atendido', icon: 'check', show: s === 'in_progress' || s === 'confirmed', primary: s === 'in_progress' },
    { status: 'no_show', label: 'No vino', icon: 'alert-triangle', show: s === 'scheduled' || s === 'confirmed' || s === 'waiting', primary: false },
    { status: 'scheduled', label: 'Reactivar', icon: 'refresh', show: s === 'cancelled' || s === 'no_show', primary: true },
  ];
  return all.filter((a) => a.show);
});

async function setStatus(status: string) {
  busy.value = status;
  try {
    await api(`/appointments/${props.appt.id}/status`, { method: 'PATCH', body: { status } });
    ui.success('Turno actualizado', APPOINTMENT_STATUS[status]?.label);
    emit('updated');
    // Al llamarlo a pasar es cuando se escribe la evolución, no después: se abre
    // la historia del paciente en ese momento.
    if (status === 'in_progress') {
      emit('close');
      router.push({ path: '/pacientes', query: { id: props.appt.person_id, nueva: '1' } });
    }
  } catch (e) {
    ui.error('No se pudo actualizar', errMessage(e));
  } finally {
    busy.value = '';
  }
}

async function cancel() {
  const ok = await ui.confirm({
    title: '¿Cancelar el turno?',
    desc: `${fullName(props.appt)} · ${fmtTime(props.appt.starts_at)}. El horario queda libre para otro paciente.`,
    confirmLabel: 'Cancelar turno',
    cancelLabel: 'Volver',
    danger: true,
  });
  if (ok) await setStatus('cancelled');
}
</script>

<template>
  <UiModal
    :title="fullName(appt)"
    :subtitle="`${capitalize(fmtDayLong(appt.starts_at))} · ${fmtTime(appt.starts_at)}–${fmtTime(appt.ends_at)}`"
    @close="emit('close')"
  >
    <div class="row tight mb-lg">
      <StatusChip :status="appt.status" />
      <span v-if="appt.is_overbook" class="chip warning" title="Se cargó encima de otro turno">
        <UiIcon name="alert-triangle" size="12" />Sobreturno
      </span>
      <span v-if="esperaTexto" class="chip warning">
        <UiIcon name="clock" size="12" />{{ esperaTexto }}
      </span>
      <span class="chip gray"><UiIcon name="user" size="12" />{{ prof }}</span>
      <span class="chip gray"><UiIcon name="door" size="12" />{{ room }}</span>
    </div>

    <div class="panel stack-sm">
      <div class="row tight nowrap">
        <UiIcon name="id-card" size="15" style="color:var(--muted)" />
        <span class="text-sm muted">DNI</span>
        <span class="text-sm strong" style="margin-left:auto">{{ appt.dni }}</span>
      </div>
      <div class="row tight nowrap">
        <UiIcon name="phone" size="15" style="color:var(--muted)" />
        <span class="text-sm muted">Teléfono</span>
        <span class="text-sm strong" style="margin-left:auto">{{ appt.phone || '—' }}</span>
      </div>
      <div class="row tight nowrap">
        <UiIcon name="file-text" size="15" style="color:var(--muted)" />
        <span class="text-sm muted">Motivo</span>
        <span class="text-sm" style="margin-left:auto">{{ appt.reason || '—' }}</span>
      </div>
    </div>

    <div v-if="appt.phone" class="row tight mt-md">
      <a class="btn secondary sm" :href="`tel:${appt.phone}`">
        <UiIcon name="phone" size="15" /> Llamar
      </a>
      <a v-if="wa" class="btn secondary sm" :href="wa" target="_blank" rel="noopener">
        <UiIcon name="whatsapp" size="15" /> WhatsApp
      </a>
    </div>

    <template #footer>
      <template v-if="canEdit">
        <button
          v-if="appt.status !== 'cancelled'"
          class="btn danger sm"
          style="margin-right:auto"
          @click="cancel"
        >
          <UiIcon name="ban" size="15" /> Cancelar turno
        </button>
        <button
          v-for="a in actions"
          :key="a.status"
          class="btn sm"
          :class="{ secondary: !a.primary }"
          :disabled="!!busy"
          @click="setStatus(a.status)"
        >
          <UiIcon :name="a.icon" size="15" /> {{ a.label }}
        </button>
      </template>
      <button class="btn ghost sm" @click="emit('close')">Cerrar</button>
    </template>
  </UiModal>
</template>
