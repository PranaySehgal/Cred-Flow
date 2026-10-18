import { createAccount, login, resendLoginCode, verifyLoginCode } from './backend.js';
import { clearDb } from './db.js';
import { signIn } from './session.js';

clearDb();

let selectedRole = 'merchant';
let mode = 'login';
let pendingChallenge = null;

const form = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const submitButton = document.getElementById('login-submit');
const errorPanel = document.getElementById('login-error');
const errorText = document.getElementById('login-error-text');
const heading = document.getElementById('form-heading');
const subheading = document.getElementById('form-subheading');
const roleHint = document.getElementById('role-hint');
const roleLabel = document.getElementById('role-label');
const rolePicker = document.getElementById('role-picker');
const usernameGroup = document.getElementById('username-group');
const passwordGroup = document.getElementById('password-group');
const otpGroup = document.getElementById('otp-group');
const codeInput = document.getElementById('login-code');
const resendButton = document.getElementById('resend-code');
const signupConfirmation = document.getElementById('signup-confirmation');
const signupConfirmationTitle = document.getElementById('signup-confirmation-title');
const signupConfirmationMessage = document.getElementById('signup-confirmation-message');

const modeButton = document.createElement('button');
modeButton.type = 'button';
modeButton.className = 'btn btn-ghost btn-block btn-sm';
modeButton.style.marginTop = '0.5rem';
modeButton.textContent = 'Create an account';
submitButton.after(modeButton);

const roleHints = {
  merchant: 'Shop owner · merchant account',
  lender: 'Credit provider · lender account',
  agent: 'Field team · agent account',
  superadmin: 'Platform operations · super admin',
};

function updateRoleHint() {
  roleLabel.textContent = mode === 'register' ? 'Account type to add' : 'Signing in as';
  const canCreateAccount = !['agent', 'superadmin'].includes(selectedRole);
  modeButton.hidden = !canCreateAccount || Boolean(pendingChallenge);
  modeButton.style.display = modeButton.hidden ? 'none' : '';
  roleHint.textContent = mode === 'register'
    ? `Create or add ${selectedRole} access using your existing credentials.`
    : roleHints[selectedRole];
}

document.querySelectorAll('.role-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    selectedRole = button.dataset.role;
    if (['agent', 'superadmin'].includes(selectedRole) && mode === 'register') {
      mode = 'login';
      heading.textContent = 'Sign in';
      subheading.textContent = 'Sign in using your CreditFlow account credentials.';
      submitButton.textContent = 'Sign in';
      document.getElementById('account-password').autocomplete = 'current-password';
    }
    updateRoleHint();
  });
});

modeButton.addEventListener('click', () => {
  if (pendingChallenge || ['agent', 'superadmin'].includes(selectedRole)) return;
  mode = mode === 'login' ? 'register' : 'login';
  const registering = mode === 'register';
  heading.textContent = registering ? 'Create your account' : 'Sign in';
  subheading.textContent = registering
    ? 'Create another role with your existing username and password, or create a new account.'
    : 'Sign in using your CreditFlow account credentials.';
  submitButton.textContent = registering ? 'Create account' : 'Sign in';
  modeButton.textContent = registering ? 'I already have an account' : 'Create an account';
  document.getElementById('account-password').autocomplete = 'current-password';
  updateRoleHint();
  hideError();
});

resendButton.addEventListener('click', async () => {
  if (!pendingChallenge) return;
  resendButton.disabled = true;
  hideError();
  try {
    const result = await resendLoginCode(pendingChallenge.challengeId);
    if (result?.STATUS !== 'SUCCESS') {
      throw new Error(result?.detail || 'Could not send another verification code.');
    }
    roleHint.textContent = result.message;
  } catch (error) {
    errorText.textContent = error.message;
    errorPanel.style.display = 'flex';
  } finally {
    resendButton.disabled = false;
  }
});

document.getElementById('close-signup-confirmation').addEventListener('click', () => {
  signupConfirmation.close();
  usernameInput.focus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError();
  submitButton.disabled = true;
  modeButton.disabled = true;

  const username = usernameInput.value.trim();
  const password = document.getElementById('account-password').value;
  try {
    if (mode === 'register' && ['agent', 'superadmin'].includes(selectedRole)) {
      throw new Error('Account creation is disabled for this account type.');
    }

    if (pendingChallenge) {
      const result = await verifyLoginCode(pendingChallenge.challengeId, codeInput.value.trim());
      if (result?.STATUS !== 'SUCCESS') {
        const messages = {
          OTP_INVALID: 'That code is incorrect. Check your email and try again.',
          OTP_EXPIRED: 'That code has expired. Sign in again to request a new one.',
          OTP_LOCKED: 'Too many incorrect attempts. Sign in again to request a new code.',
        };
        if (result?.STATUS === 'OTP_EXPIRED' || result?.STATUS === 'OTP_LOCKED') {
          resetMfaStep();
        }
        throw new Error(messages[result?.STATUS] || 'Could not verify the sign-in code.');
      }

      const { role, username: verifiedUsername } = pendingChallenge;
      const ranking = result.ranking;
      signIn(role, verifiedUsername, ranking && {
        status: ranking.status,
        rating: ranking.rating,
        message: ranking.message,
        risk_tier: ranking.result?.risk_tier,
      }, result.access_token);
      window.location.href = {
        agent: 'agent/index.html',
        superadmin: 'superadmin/index.html',
      }[role] || 'profile.html';
      return;
    }

    const result = mode === 'login'
      ? await login(username, password, selectedRole)
      : await createAccount(username, password, selectedRole);

    if (mode === 'login') {
      if (result?.STATUS === 'MFA_REQUIRED' && result.challenge_id) {
        pendingChallenge = {
          challengeId: result.challenge_id,
          role: selectedRole,
          username,
        };
        rolePicker.hidden = true;
        usernameGroup.hidden = true;
        passwordGroup.hidden = true;
        otpGroup.hidden = false;
        usernameInput.required = false;
        document.getElementById('account-password').required = false;
        codeInput.required = true;
        submitButton.textContent = 'Verify and sign in';
        modeButton.hidden = true;
        heading.textContent = 'Verify it’s you';
        subheading.textContent = result.message;
        roleHint.textContent = `Verification code sent for your ${selectedRole} sign-in.`;
        codeInput.focus();
        return;
      }
      if (result?.STATUS !== 'SUCCESS') {
        const messages = {
          PENDING_APPROVAL: 'This account type is waiting for super-admin approval. You can sign in after it is approved.',
          ACCOUNT_REJECTED: 'This account type request was not approved. Contact the super admin for assistance.',
        };
        throw new Error(messages[result?.STATUS] || result?.STATUS || 'The backend did not authenticate this account.');
      }
      const ranking = result.ranking;
      signIn(selectedRole, username, ranking && {
        status: ranking.status,
        rating: ranking.rating,
        message: ranking.message,
        risk_tier: ranking.result?.risk_tier,
      }, result.access_token);
      window.location.href = selectedRole === 'superadmin'
        ? 'superadmin/index.html'
        : selectedRole === 'agent' ? 'agent/index.html' : 'profile.html';
      return;
    }

    if (result?.STATUS && result.STATUS !== 'SUCCESS') {
      const messages = {
        'ACCESS DENIED': 'This account type cannot be created through this form.',
        'ACCOUNT TYPE ALREADY EXISTS': `You already have a ${selectedRole} account.`,
        'Invalid Username Or Password': 'That username already exists. Enter its password to add another account type.',
        PENDING_APPROVAL: 'This account type is waiting for super-admin approval. You can sign in after it is approved.',
        ACCOUNT_REJECTED: 'This account type request was not approved. Contact the super admin for assistance.',
      };
      throw new Error(messages[result.STATUS] || result.STATUS);
    }
    if (!result?.message) throw new Error('The backend did not confirm account creation.');
    mode = 'login';
    heading.textContent = 'Sign in';
    const pendingApproval = result.message.toLowerCase().includes('approval');
    subheading.textContent = pendingApproval
      ? `${result.message} After approval, sign in with the same credentials.`
      : `${result.message} Sign in with the same credentials.`;
    signupConfirmationTitle.textContent = pendingApproval
      ? 'Account request submitted'
      : 'Account created';
    signupConfirmationMessage.textContent = pendingApproval
      ? `${result.message} A super admin must approve this ${selectedRole} account type before you can sign in. Once approved, return here and sign in with the same email and password.`
      : `${result.message} You can now sign in here using the same email and password.`;
    submitButton.textContent = 'Sign in';
    modeButton.textContent = 'Create an account';
    form.reset();
    usernameInput.value = username;
    updateRoleHint();
    signupConfirmation.showModal();
    document.getElementById('close-signup-confirmation').focus();
  } catch (error) {
    errorText.textContent = error.message;
    errorPanel.style.display = 'flex';
  } finally {
    submitButton.disabled = false;
    modeButton.disabled = false;
  }
});

function resetMfaStep() {
  pendingChallenge = null;
  rolePicker.hidden = false;
  usernameGroup.hidden = false;
  passwordGroup.hidden = false;
  otpGroup.hidden = true;
  usernameInput.required = true;
  document.getElementById('account-password').required = true;
  codeInput.required = false;
  codeInput.value = '';
  submitButton.textContent = 'Sign in';
  modeButton.hidden = false;
  heading.textContent = 'Sign in';
  subheading.textContent = 'Sign in using your CreditFlow account credentials.';
  updateRoleHint();
}

function hideError() {
  errorPanel.style.display = 'none';
  errorText.textContent = '';
}
