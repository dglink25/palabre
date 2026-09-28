import { useEffect, useRef, useState } from 'react';
import { api, setConfirmationHandler } from '../lib/apiClient';
import { Alert } from './ui';
import { friendlyMessage } from '../lib/errorMessages';

/**
 * Branché une seule fois (voir App.jsx) sur apiClient.setConfirmationHandler :
 * quand une requête de modification renvoie 428 (super-admin uniquement),
 * l'apiClient ouvre cette modale et attend un jeton avant de rejouer la
 * requête. Voir writeConfirmation.service.js côté backend.
 */
export default function StepUpConfirmModal() {
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const resolverRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    setConfirmationHandler(() => {
      return new Promise((resolve, reject) => {
        resolverRef.current = { resolve, reject };
        startedRef.current = false;
        setError('');
        setCode('');
        setVisible(true);
        api.post('/security/step-up/start').catch(() => {});
      });
    });
  }, []);

  async function resend() {
    setSending(true);
    setError('');
    try {
      await api.post('/security/step-up/start');
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setSending(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const result = await api.post('/security/step-up/verify', { code });
      setVisible(false);
      resolverRef.current.resolve(result.confirmationToken);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setSending(false);
    }
  }

  function cancel() {
    setVisible(false);
    resolverRef.current.reject(new Error('Double vérification annulée.'));
  }

  if (!visible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Double vérification requise</h2>
        <p className="text-secondary">
          Cette modification exige une confirmation. Un code a été envoyé à votre adresse e-mail.
        </p>
        <Alert variant="danger">{error}</Alert>
        <form onSubmit={submit}>
          <div className="field">
            <label>Code reçu par e-mail</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          </div>
          <button className="btn btn-block" type="submit" disabled={sending}>Confirmer</button>
          <div className="spacer" />
          <button className="btn btn-secondary btn-block" type="button" onClick={resend} disabled={sending}>Renvoyer le code</button>
          <div className="spacer" />
          <button className="btn btn-secondary btn-block" type="button" onClick={cancel}>Annuler</button>
        </form>
      </div>
    </div>
  );
}
