<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppShell from '../../components/AppShell.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import UiAvatar from '../../components/ui/UiAvatar.vue';
import UiEmpty from '../../components/ui/UiEmpty.vue';
import UiIcon from '../../components/ui/UiIcon.vue';
import UiSkeleton from '../../components/ui/UiSkeleton.vue';
import { api, errMessage, qs } from '../../lib/api';
import { DURACIONES, WEEKDAYS, WEEKDAYS_SHORT, addDays, fmtDate, todayISO } from '../../lib/format';
import type { AvailabilityBlock, Professional, Room } from '../../lib/types';
import { useAuth } from '../../stores/auth';
import { useUi } from '../../stores/ui';

const auth = useAuth();
const ui = useUi();

const professionals = ref<Professional[]>([]);
const rooms = ref<Room[]>([]);
const blocks = ref<AvailabilityBlock[]>([]);
const profId = ref('');
const loading = ref(true);
const saving = ref(false);

// Se cargan varios días de una: "lunes a viernes de 9 a 13" es una sola acción.
const form = reactive({
  weekdays: new Set<number>([1, 2, 3, 4, 5]),
  startTime: '09:00',
  endTime: '13:00',
  slotMinutes: 30,
  roomId: '',
});

const canPickProfessional = computed(() => auth.isAdmin);

// Bloqueos y aperturas puntuales: vacaciones, feriados, una tarde libre.
interface Exception {
  id: string;
  date: string;
  date_to?: string;
  kind: 'add' | 'remove';
  start_time: string | null;
  end_time: string | null;
}
const exceptions = ref<Exception[]>([]);
const savingException = ref(false);
const exception = reactive({
  date: addDays(todayISO(), 1),
  dateTo: '',
  kind: 'remove' as 'remove' | 'add',
  allDay: true,
  startTime: '09:00',
  endTime: '13:00',
});

async function loadExceptions() {
  if (!profId.value) return;
  exceptions.value = await api<Exception[]>(
    '/availability-exceptions' + qs({ professionalId: profId.value, from: todayISO() }),
  ).catch(() => []);
}

async function createException() {
  savingException.value = true;
  try {
    await api('/availability-exceptions', {
      method: 'POST',
      body: {
        professionalId: profId.value,
        date: exception.date,
        // Sin fin, es de un día: lo resuelve el backend.
        dateTo: exception.dateTo || undefined,
        kind: exception.kind,
        startTime: exception.allDay && exception.kind === 'remove' ? undefined : exception.startTime,
        endTime: exception.allDay && exception.kind === 'remove' ? undefined : exception.endTime,
      },
    });
    ui.success(
      exception.kind === 'remove' ? 'Agenda bloqueada' : 'Horario extra agregado',
      fmtDate(exception.date),
    );
    await loadExceptions();
  } catch (e) {
    ui.error('No se pudo guardar', errMessage(e));
  } finally {
    savingException.value = false;
  }
}

async function removeException(e: Exception) {
  const ok = await ui.confirm({
    title: e.kind === 'remove' ? '¿Quitar el bloqueo?' : '¿Quitar el horario extra?',
    desc:
      e.kind === 'remove'
        ? `El ${fmtDate(e.date)} vuelve a estar disponible para agendar.`
        : `Se sacan los huecos extra del ${fmtDate(e.date)}.`,
    confirmLabel: 'Quitar',
    danger: e.kind === 'add',
  });
  if (!ok) return;
  await api(`/availability-exceptions/${e.id}`, { method: 'DELETE' }).catch((err) =>
    ui.error('No se pudo quitar', errMessage(err)),
  );
  await loadExceptions();
}

async function removeBlock(id: string) {
  const ok = await ui.confirm({
    title: '¿Borrar este horario?',
    desc: 'Deja de generar huecos. Los turnos ya agendados no se tocan.',
    confirmLabel: 'Borrar',
    danger: true,
  });
  if (!ok) return;
  try {
    await api(`/availability-blocks/${id}`, { method: 'DELETE' });
    ui.success('Horario borrado');
    await loadBlocks();
  } catch (e) {
    ui.error('No se pudo borrar', errMessage(e));
  }
}

const byDay = computed(() => {
  const map: Record<number, AvailabilityBlock[]> = {};
  for (let d = 0; d < 7; d++) map[d] = [];
  for (const b of blocks.value) map[b.weekday]?.push(b);
  for (const d of Object.keys(map)) {
    map[+d].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
  return map;
});

const weeklyHours = computed(() =>
  blocks.value.reduce((sum, b) => {
    const [sh, sm] = b.start_time.split(':').map(Number);
    const [eh, em] = b.end_time.split(':').map(Number);
    return sum + (eh * 60 + em - sh * 60 - sm) / 60;
  }, 0),
);

const roomName = (id: string | null) =>
  rooms.value.find((r) => r.id === id)?.name ?? 'Sin sala fija';

const hhmm = (t: string) => t.slice(0, 5);

async function loadBlocks() {
  if (!profId.value) return;
  loading.value = true;
  try {
    blocks.value = await api<AvailabilityBlock[]>(
      '/availability-blocks' + qs({ professionalId: profId.value }),
    );
  } catch (e) {
    ui.error('No se pudieron cargar los horarios', errMessage(e));
  } finally {
    loading.value = false;
  }
}

function toggleDay(d: number) {
  const next = new Set(form.weekdays);
  next.has(d) ? next.delete(d) : next.add(d);
  form.weekdays = next;
}

async function create() {
  if (!form.weekdays.size) return;
  if (form.endTime <= form.startTime) {
    ui.error('Revisá el horario', 'La hora de fin tiene que ser posterior a la de inicio.');
    return;
  }
  saving.value = true;
  try {
    for (const weekday of [...form.weekdays].sort()) {
      await api('/availability-blocks', {
        method: 'POST',
        body: {
          professionalId: profId.value,
          roomId: form.roomId || undefined,
          weekday,
          startTime: form.startTime,
          endTime: form.endTime,
          slotMinutes: Number(form.slotMinutes),
        },
      });
    }
    ui.success(
      'Horario agregado',
      `${form.weekdays.size} día(s) · ${form.startTime} a ${form.endTime}`,
    );
    await loadBlocks();
  } catch (e) {
    ui.error('No se pudo guardar', errMessage(e));
  } finally {
    saving.value = false;
  }
}

watch(profId, () => {
  loadBlocks();
  loadExceptions();
});

onMounted(async () => {
  try {
    const [profs, rms] = await Promise.all([
      api<Professional[]>('/users/professionals'),
      api<Room[]>('/rooms').catch(() => [] as Room[]),
    ]);
    professionals.value = profs;
    rooms.value = rms;
    const own = profs.find((p) => p.id === auth.user?.id);
    profId.value = canPickProfessional.value
      ? (own?.id ?? profs[0]?.id ?? '')
      : (own?.id ?? '');
    await loadBlocks();
    await loadExceptions();
  } catch (e) {
    ui.error('Error al cargar', errMessage(e));
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <AppShell width="wide">
    <PageHeader
      title="Horarios de atención"
      subtitle="De acá salen los huecos que ve la recepción. Sin horarios cargados no se puede agendar."
    />

    <div v-if="canPickProfessional" class="row mb-lg">
      <div style="min-width:240px">
        <label class="label">Profesional</label>
        <select v-model="profId">
          <option v-for="p in professionals" :key="p.id" :value="p.id">{{ p.full_name }}</option>
        </select>
      </div>
      <div class="spacer"></div>
      <div class="row tight">
        <UiAvatar :name="professionals.find((p) => p.id === profId)?.full_name" size="sm" />
        <span class="muted text-sm">{{ weeklyHours.toFixed(1) }} h por semana</span>
      </div>
    </div>

    <UiEmpty
      v-if="!profId && !loading"
      icon="user"
      title="No hay un profesional asociado a tu usuario"
      desc="Los horarios se cargan por profesional. Pedile a un admin que te asigne el rol."
    />

    <template v-else>
      <div class="card flush mb-lg">
        <div class="card-head">
          <UiIcon name="clock" size="17" style="color:var(--muted)" />
          <h2>Semana tipo</h2>
          <span class="chip gray" style="margin-left:auto">{{ blocks.length }} bloques</span>
        </div>

        <div v-if="loading" style="padding:12px"><UiSkeleton :rows="4" /></div>

        <div v-else class="checklist">
          <div
            v-for="(day, i) in WEEKDAYS"
            :key="day"
            class="check-row"
            :style="byDay[i].length ? '' : 'opacity:.6'"
          >
            <span class="chip" :class="byDay[i].length ? '' : 'gray'" style="width:52px;justify-content:center">
              {{ WEEKDAYS_SHORT[i] }}
            </span>
            <div class="check-main">
              <div v-if="byDay[i].length" class="row tight">
                <span v-for="b in byDay[i]" :key="b.id" class="panel row tight nowrap" style="padding:4px 6px 4px 10px">
                  <UiIcon name="clock" size="13" style="color:var(--muted-2)" />
                  <span class="text-sm strong">{{ hhmm(b.start_time) }}–{{ hhmm(b.end_time) }}</span>
                  <span class="muted text-xs">· {{ b.slot_minutes }} min · {{ roomName(b.room_id) }}</span>
                  <button
                    class="icon-btn"
                    style="width:24px;height:24px"
                    title="Borrar este horario"
                    @click="removeBlock(b.id)"
                  >
                    <UiIcon name="x" size="14" />
                  </button>
                </span>
              </div>
              <div v-else class="muted text-sm">No atiende</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card pad-sm">
        <h3 class="mb-md">Agregar horario</h3>
        <form @submit.prevent="create">
          <div class="field">
            <label class="label">Días</label>
            <div class="row tight">
              <button
                v-for="(d, i) in WEEKDAYS_SHORT"
                :key="d"
                type="button"
                class="chip"
                :class="{ gray: !form.weekdays.has(i) }"
                style="cursor:pointer;padding:5px 12px"
                @click="toggleDay(i)"
              >
                {{ d }}
              </button>
              <button
                type="button"
                class="btn secondary xs"
                @click="form.weekdays = new Set([1, 2, 3, 4, 5])"
              >
                Lun a Vie
              </button>
            </div>
          </div>

          <div class="grid2">
            <div class="field">
              <label class="label">Desde</label>
              <input type="time" v-model="form.startTime" required />
            </div>
            <div class="field">
              <label class="label">Hasta</label>
              <input type="time" v-model="form.endTime" required />
            </div>
          </div>

          <div class="grid2">
            <div class="field">
              <label class="label">Duración del turno</label>
              <select v-model="form.slotMinutes">
                <option v-for="d in DURACIONES" :key="d.valor" :value="d.valor">{{ d.texto }}</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Consultorio</label>
              <select v-model="form.roomId">
                <option value="">Sin sala fija</option>
                <option v-for="r in rooms" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
            </div>
          </div>

          <div class="row end">
            <span class="muted text-xs spacer">
              Se crea un bloque por cada día seleccionado.
            </span>
            <button class="btn" :disabled="saving || !form.weekdays.size">
              <span v-if="saving" class="spinner"></span>
              <UiIcon v-else name="plus" size="15" /> Agregar horario
            </button>
          </div>
        </form>
      </div>

      <!-- Bloqueos puntuales -->
      <div class="card flush mt-lg">
        <div class="card-head">
          <UiIcon name="calendar-x" size="17" style="color:var(--muted)" />
          <div>
            <h2>Bloqueos y horarios extra</h2>
            <p class="muted text-sm">
              Vacaciones, feriados o un sábado que sí atendés. La agenda los respeta al buscar
              huecos.
            </p>
          </div>
        </div>

        <div v-if="exceptions.length" class="table-wrap">
          <table>
            <tbody>
              <tr v-for="e in exceptions" :key="e.id">
                <td style="width:1%">
                  <span class="chip" :class="e.kind === 'remove' ? 'danger' : 'success'">
                    {{ e.kind === 'remove' ? 'Bloqueado' : 'Extra' }}
                  </span>
                </td>
                <td>
                  <span class="text-sm strong">
                    {{ fmtDate(e.date) }}<template v-if="e.date_to && e.date_to !== e.date">
                      al {{ fmtDate(e.date_to) }}</template>
                  </span>
                  <span class="muted text-sm">
                    ·
                    {{
                      e.start_time
                        ? `${e.start_time.slice(0, 5)}–${(e.end_time || '23:59').slice(0, 5)}`
                        : 'todo el día'
                    }}
                  </span>
                </td>
                <td class="actions">
                  <button class="icon-btn" title="Quitar" @click="removeException(e)">
                    <UiIcon name="x" size="16" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UiEmpty
          v-else
          icon="calendar-check"
          title="Sin bloqueos cargados"
          desc="La agenda sigue la semana tipo todos los días."
        />

        <div class="card-foot">
          <form class="row tight" style="align-items:flex-end" @submit.prevent="createException">
            <div>
              <label class="label">Qué</label>
              <select v-model="exception.kind" style="width:auto">
                <option value="remove">Bloquear</option>
                <option value="add">Agregar horas</option>
              </select>
            </div>
            <div>
              <label class="label">Desde el día</label>
              <input type="date" v-model="exception.date" :min="todayISO()" style="width:150px" />
            </div>
            <div>
              <label class="label">Hasta el día</label>
              <!-- Vacío = un solo día. Con vacaciones se pone el último y va en
                   una sola fila, no una por día. -->
              <input
                type="date"
                v-model="exception.dateTo"
                :min="exception.date || todayISO()"
                style="width:150px"
                placeholder="opcional"
              />
            </div>
            <label v-if="exception.kind === 'remove'" class="check" style="margin-bottom:9px">
              <input type="checkbox" v-model="exception.allDay" />
              Todo el día
            </label>
            <template v-if="exception.kind === 'add' || !exception.allDay">
              <div>
                <label class="label">Desde</label>
                <input type="time" v-model="exception.startTime" style="width:110px" />
              </div>
              <div>
                <label class="label">Hasta</label>
                <input type="time" v-model="exception.endTime" style="width:110px" />
              </div>
            </template>
            <button class="btn sm" :disabled="savingException">
              <span v-if="savingException" class="spinner"></span>
              <UiIcon v-else name="plus" size="15" />
              Guardar
            </button>
          </form>
        </div>
      </div>
    </template>
  </AppShell>
</template>
