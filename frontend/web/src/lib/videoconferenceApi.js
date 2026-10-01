/**
 * videoconferenceApi.js
 * Wrappers API pour le module vidéoconférence Palabre.
 * Aucune référence à Jitsi ne doit apparaître ici côté client.
 */
import { api } from './apiClient';

const BASE = '/videoconference';

// ── Rooms ─────────────────────────────────────────────────────────────────

/** Créer une vidéoconférence dans l'espace tenant */
export function createRoom({ title, accessPolicy = 'closed', immediate = true, scheduledAt, estimatedDurationMin, inviteeIds = [] }) {
  return api.post(`${BASE}/rooms`, { title, accessPolicy, immediate, scheduledAt, estimatedDurationMin, inviteeIds });
}

/** Créer une vidéoconférence publique (depuis la page d'accueil) */
export function createPublicRoom({ title, accessPolicy = 'closed', immediate = true, scheduledAt, estimatedDurationMin, inviteeIdentifiers = [] }) {
  return api.post(`${BASE}/public/rooms`, { title, accessPolicy, immediate, scheduledAt, estimatedDurationMin, inviteeIdentifiers });
}

/** Lister les rooms du tenant */
export function listRooms({ page = 1, limit = 50 } = {}) {
  return api.get(`${BASE}/rooms?page=${page}&limit=${limit}`);
}

/** Détail d'une room */
export function getRoom(roomId) {
  return api.get(`${BASE}/rooms/${roomId}`);
}

/** Modifier une room planifiée */
export function updateRoom(roomId, updates) {
  return api.patch(`${BASE}/rooms/${roomId}`, updates);
}

/** Annuler une room */
export function cancelRoom(roomId) {
  return api.delete(`${BASE}/rooms/${roomId}`);
}

// ── Session Jitsi (usage interne du composant VideoConferenceGateway) ─────

/** Résoudre la configuration Jitsi pour une room (retourne domain + roomToken opaque) */
export function resolveSession(roomId, sessionToken) {
  return api.post(`${BASE}/rooms/${roomId}/session`, { sessionToken });
}

// ── Rejoindre / Quitter ───────────────────────────────────────────────────

/** Rejoindre une room (retourne { status: 'admitted'|'waiting', sessionToken? }) */
export function joinRoom(roomId, invitationToken = null) {
  return api.post(`${BASE}/rooms/${roomId}/join`, { invitationToken });
}

/** Quitter une room */
export function leaveRoom(roomId) {
  return api.post(`${BASE}/rooms/${roomId}/leave`);
}

/** Terminer une room (hôte uniquement) */
export function endRoom(roomId) {
  return api.post(`${BASE}/rooms/${roomId}/end`);
}

// ── Modération ────────────────────────────────────────────────────────────

/** Admettre un participant depuis la salle d'attente */
export function admitParticipant(roomId, targetUserId) {
  return api.post(`${BASE}/rooms/${roomId}/admit/${targetUserId}`);
}

/** Exclure un participant */
export function kickParticipant(roomId, targetUserId) {
  return api.post(`${BASE}/rooms/${roomId}/kick/${targetUserId}`);
}

/** Lister les participants d'une room */
export function getParticipants(roomId) {
  return api.get(`${BASE}/rooms/${roomId}/participants`);
}

// ── Invitations ───────────────────────────────────────────────────────────

/** Inviter des utilisateurs (par email ou nom) */
export function inviteUsers(roomId, identifiers = []) {
  return api.post(`${BASE}/rooms/${roomId}/invite`, { identifiers });
}

/** Résoudre un token d'invitation */
export function resolveInvitation(token) {
  return api.get(`${BASE}/invite/${token}`);
}

// ── Enregistrement ────────────────────────────────────────────────────────

/** Démarrer l'enregistrement */
export function startRecording(roomId) {
  return api.post(`${BASE}/rooms/${roomId}/recording/start`);
}

/** Arrêter l'enregistrement */
export function stopRecording(roomId) {
  return api.post(`${BASE}/rooms/${roomId}/recording/stop`);
}
