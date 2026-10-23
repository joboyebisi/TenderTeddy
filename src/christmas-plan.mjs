export function buildChristmasPlan({ mode, recipients, budget, deadline }) {
  if (!['personal', 'enterprise'].includes(mode)) throw new Error('Unknown Christmas plan mode');
  if (!recipients?.length || budget <= 0) throw new Error('Recipients and positive budget required');
  const perPerson = mode === 'enterprise' ? Math.floor(budget / recipients.length) : null;
  return {
    mode, recipients, budget, deadline, perPerson,
    stages: ['discover', 'confirm', 'recommend', 'approve', 'fulfil', 'thank'],
    approvals: mode === 'enterprise' ? ['campaign-owner', 'finance-owner'] : ['account-owner']
  };
}

