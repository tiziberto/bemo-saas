<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '../components/AuthLayout.vue';
import UiIcon from '../components/ui/UiIcon.vue';
import { errMessage } from '../lib/api';
import { useAuth } from '../stores/auth';
import { useUi } from '../stores/ui';

const auth = useAuth();
const ui = useUi();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const showPass = ref(false);
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    ui.success(`Hola, ${auth.displayName}`);
    router.push((route.query.next as string) || '/hoy');
  } catch (e) {
    error.value = errMessage(e, 'No pudimos ingresar');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <div class="card pad">
      <h1 style="font-size:20px">Ingresar</h1>
      <p class="muted text-sm mb-lg" style="margin-top:4px">
        Entrá con tu email del consultorio.
      </p>

      <form @submit.prevent="submit">
        <div class="field">
          <label class="label" for="email">Email</label>
          <input id="email" v-model="email" type="email" required autofocus autocomplete="username" />
        </div>
        <div class="field">
          <label class="label" for="pass">Contraseña</label>
          <div style="position:relative">
            <input
              id="pass"
              v-model="password"
              :type="showPass ? 'text' : 'password'"
              required
              autocomplete="current-password"
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
        </div>

        <div v-if="error" class="alert err">
          <UiIcon name="alert-circle" size="16" />{{ error }}
        </div>

        <button class="btn block lg mt-md" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>
    </div>

    <p class="muted text-sm" style="text-align:center;margin-top:16px">
      ¿Consultorio nuevo? <router-link to="/register">Registrá tu clínica</router-link>
    </p>
    <p class="muted text-xs" style="text-align:center;margin-top:6px">
      ¿Te invitaron al equipo? <router-link to="/invitacion">Activá tu cuenta</router-link>
    </p>
  </AuthLayout>
</template>
