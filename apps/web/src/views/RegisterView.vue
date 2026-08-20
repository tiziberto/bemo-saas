<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthLayout from '../components/AuthLayout.vue';
import UiIcon from '../components/ui/UiIcon.vue';
import { api, errMessage } from '../lib/api';
import { useAuth } from '../stores/auth';
import { useUi } from '../stores/ui';

const auth = useAuth();
const ui = useUi();
const router = useRouter();

const clinicName = ref('');

/**
 * Especialidades al registrarse. Es opcional: si alguien no las carga acá, las
 * agrega después en Configuración › Clínica. Bloquear el registro por esto sería
 * ponerle una barrera a lo único que importa en ese momento, que es entrar.
 */
interface Especialidad { id: string; label: string }
const catalogo = ref<Especialidad[]>([]);
const especialidades = ref<string[]>([]);
onMounted(async () => {
  // El catálogo es público para poder mostrarlo antes de tener sesión.
  catalogo.value = await api<Especialidad[]>('/specialties').catch(() => []);
});
const fullName = ref('');
const email = ref('');
const password = ref('');
const showPass = ref(false);
const error = ref('');
const loading = ref(false);

const strength = computed(() => {
  const p = password.value;
  if (p.length < 8) return { label: 'Muy corta (mínimo 8)', tone: 'var(--danger)', pct: 25 };
  let score = 1;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^\w\s]/.test(p)) score++;
  if (p.length >= 12) score++;
  if (score <= 2) return { label: 'Aceptable', tone: 'var(--warning)', pct: 50 };
  if (score === 3) return { label: 'Buena', tone: 'var(--success)', pct: 75 };
  return { label: 'Muy buena', tone: 'var(--success)', pct: 100 };
});

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.registerClinic({
      clinicName: clinicName.value.trim(),
      fullName: fullName.value.trim(),
      email: email.value.trim(),
      password: password.value,
    });
    // Recién acá hay sesión, así que las especialidades van después del alta.
    if (especialidades.value.length) {
      await api('/clinic/specialties', {
        method: 'PUT',
        body: { specialtyIds: especialidades.value },
      }).catch(() => {
        ui.error('La clínica se creó, pero no las especialidades', 'Cargalas en Configuración › Clínica.');
      });
    }
    ui.success('Clínica creada', 'Ahora cargá consultorios y horarios.');
    router.push('/hoy');
  } catch (e) {
    error.value = errMessage(e, 'No pudimos crear la clínica');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <div class="card pad">
      <h1 style="font-size:20px">Registrá tu consultorio</h1>
      <p class="muted text-sm mb-lg" style="margin-top:4px">
        Creás la clínica y tu usuario administrador. Después invitás al equipo.
      </p>

      <form @submit.prevent="submit">
        <div class="field">
          <label class="label" for="clinic">Nombre del consultorio</label>
          <input id="clinic" v-model="clinicName" required autofocus placeholder="Consultorio Odontológico Norte" />
        </div>
        <div class="field">
          <label class="label">Especialidades <span class="muted text-xs">(opcional)</span></label>
          <p class="muted text-xs mb-sm">Qué se atiende. Después se puede cambiar.</p>
          <div class="esp-grid" style="max-height:180px">
            <label v-for="e in catalogo" :key="e.id" class="esp-item">
              <input type="checkbox" :value="e.id" v-model="especialidades" />
              <span>{{ e.label }}</span>
            </label>
          </div>
        </div>
        <div class="field">
          <label class="label" for="name">Tu nombre</label>
          <input id="name" v-model="fullName" required placeholder="Dra. Ana Gómez" />
        </div>
        <div class="field">
          <label class="label" for="email">Email</label>
          <input id="email" v-model="email" type="email" required autocomplete="username" />
        </div>
        <div class="field">
          <label class="label" for="pass">Contraseña</label>
          <div style="position:relative">
            <input
              id="pass"
              v-model="password"
              :type="showPass ? 'text' : 'password'"
              required
              minlength="8"
              autocomplete="new-password"
              style="padding-right:40px"
            />
            <button
              type="button"
              class="icon-btn"
              style="position:absolute;right:3px;top:3px"
              :aria-label="showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              @click="showPass = !showPass"
            >
              <UiIcon :name="showPass ? 'eye-off' : 'eye'" size="16" />
            </button>
          </div>
          <div v-if="password" class="row tight nowrap" style="margin-top:7px">
            <div style="flex:1;height:4px;background:var(--surface-3);border-radius:99px;overflow:hidden">
              <div :style="{ width: strength.pct + '%', background: strength.tone, height: '100%', transition: 'width .2s' }"></div>
            </div>
            <span class="text-xs" :style="{ color: strength.tone }">{{ strength.label }}</span>
          </div>
        </div>

        <div v-if="error" class="alert err">
          <UiIcon name="alert-circle" size="16" />{{ error }}
        </div>

        <button class="btn block lg mt-md" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Creando…' : 'Crear clínica' }}
        </button>
      </form>
    </div>

    <p class="muted text-sm" style="text-align:center;margin-top:16px">
      ¿Ya tenés cuenta? <router-link to="/login">Ingresá</router-link>
    </p>
  </AuthLayout>
</template>
