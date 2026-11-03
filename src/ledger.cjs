const ACCOUNTS = ["carteira", "conta"];
const CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Casa",
  "Saúde",
  "Lazer",
  "Educação",
  "Compras",
  "Outros",
];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const id = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
function empty() {
  return {
    version: 1,
    accounts: [
      { id: "carteira", name: "Carteira", opening: 0 },
      { id: "conta", name: "Conta", opening: 0 },
    ],
    transactions: [],
  };
}
function money(cents) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
function parseAmount(value) {
  const s = String(value).trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s))
    throw Error("Use um valor como 25,90 ou 1.250,00.");
  const [whole, decimal = ""] = s.replace(/\./g, "").split(",");
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 99999999999)
    throw Error("Informe um valor maior que zero e menor que um bilhão.");
  return amount;
}
function dateInput(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) throw Error("Use uma data no formato DD/MM/AAAA.");
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value &&
    value >= "1900-01-01" &&
    value <= today()
  );
}
function validate(data) {
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.accounts) ||
    !data.accounts.length ||
    data.accounts.length > 30 ||
    !Array.isArray(data.transactions) ||
    data.transactions.length > 10000
  )
    throw Error(
      "Backup inválido ou acima do limite (30 contas, 10 mil lançamentos).",
    );
  const ids = new Set();
  const accounts = data.accounts.map((a) => {
    if (
      !a ||
      typeof a.id !== "string" ||
      !a.id ||
      a.id.length > 100 ||
      ids.has(a.id) ||
      typeof a.name !== "string" ||
      !a.name.trim() ||
      a.name.length > 40 ||
      !Number.isSafeInteger(a.opening) ||
      Math.abs(a.opening) > 99999999999
    )
      throw Error("Conta inválida no arquivo.");
    ids.add(a.id);
    return { id: a.id, name: a.name.trim(), opening: a.opening };
  });
  const txids = new Set();
  const transactions = data.transactions.map((t) => {
    if (
      !t ||
      typeof t.id !== "string" ||
      !t.id ||
      t.id.length > 100 ||
      txids.has(t.id) ||
      !["expense", "income", "transfer"].includes(t.type) ||
      !Number.isSafeInteger(t.amount) ||
      t.amount <= 0 ||
      t.amount > 99999999999 ||
      !validDate(t.date) ||
      !ids.has(t.account) ||
      typeof t.note !== "string" ||
      t.note.length > 120 ||
      typeof t.category !== "string" ||
      t.category.length > 40
    )
      throw Error("Lançamento inválido no arquivo.");
    if (t.type === "transfer" && (!ids.has(t.to) || t.to === t.account))
      throw Error("Escolha contas diferentes para a transferência.");
    txids.add(t.id);
    return {
      id: t.id,
      type: t.type,
      amount: t.amount,
      date: t.date,
      account: t.account,
      to: t.type === "transfer" ? t.to : null,
      category: t.category,
      note: t.note.trim(),
    };
  });
  return { version: 1, accounts, transactions };
}
function saveTransaction(data, form, editId) {
  const tx = {
    id: editId || id(),
    type: form.type,
    amount: parseAmount(form.amount),
    date: dateInput(form.date),
    account: form.account,
    to: form.to || null,
    category:
      form.type === "transfer" ? "Transferência" : form.category || "Outros",
    note: (form.note || "").trim(),
  };
  if (!validDate(tx.date)) throw Error("Escolha uma data válida, até hoje.");
  if (editId && !data.transactions.some((t) => t.id === editId))
    throw Error("Lançamento não encontrado.");
  return validate({
    ...data,
    transactions: editId
      ? data.transactions.map((t) => (t.id === editId ? tx : t))
      : [...data.transactions, tx],
  });
}
function summary(data, month) {
  const balances = Object.fromEntries(
    data.accounts.map((a) => [a.id, a.opening]),
  );
  let income = 0,
    expense = 0;
  const categories = {};
  for (const t of data.transactions) {
    balances[t.account] += t.type === "income" ? t.amount : -t.amount;
    if (t.type === "transfer") balances[t.to] += t.amount;
    if (t.date.startsWith(month) && t.type === "income") income += t.amount;
    if (t.date.startsWith(month) && t.type === "expense") {
      expense += t.amount;
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    }
  }
  return {
    balances,
    total: Object.values(balances).reduce((a, b) => a + b, 0),
    income,
    expense,
    net: income - expense,
    categories,
  };
}
module.exports = {
  ACCOUNTS,
  CATEGORIES,
  today,
  id,
  empty,
  money,
  parseAmount,
  dateInput,
  validDate,
  validate,
  saveTransaction,
  summary,
};
