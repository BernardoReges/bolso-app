import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { read, write } from "./src/storage";
import { exportData, importData } from "./src/backup";
const L = require("./src/ledger.cjs");
const localDate = (value) => value.split("-").reverse().join("/");
const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const palette = [
  "#157E69",
  "#F18462",
  "#7D76B6",
  "#5687BB",
  "#C59139",
  "#CE728B",
  "#7D9B64",
  "#85959C",
];
function Button({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        secondary && s.secondary,
        danger && s.danger,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: "#153C36" }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Field({ label, ...props }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#88958F"
        style={s.input}
        {...props}
      />
    </View>
  );
}
function Chips({ values, value, onChange }) {
  return (
    <View style={s.chips}>
      {values.map((item) => {
        const id = typeof item === "string" ? item : item.id;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: value === id }}
            key={id}
            onPress={() => onChange(id)}
            style={[s.chip, value === id && s.chipActive]}
          >
            <Text style={[s.chipText, value === id && s.chipTextActive]}>
              {typeof item === "string" ? item : item.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Bolso />
    </SafeAreaProvider>
  );
}
function Bolso() {
  const scrollRef = useRef(null);
  const [data, setData] = useState(null),
    [fatal, setFatal] = useState(""),
    [tab, setTab] = useState("Início"),
    [month, setMonth] = useState(L.today().slice(0, 7)),
    [form, setForm] = useState(null),
    [accountForm, setAccountForm] = useState(null),
    [confirm, setConfirm] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Todos");
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [tab]);
  const load = async () => {
    try {
      setFatal("");
      const raw = await read();
      setData(raw ? L.validate(JSON.parse(raw)) : L.empty());
    } catch {
      setFatal(
        "Não foi possível ler seus dados. Nada foi apagado. Tente abrir novamente; não desinstale o app para corrigir isso.",
      );
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4200);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  async function persist(next) {
    const valid = L.validate(next);
    await write(JSON.stringify(valid));
    setData(valid);
  }
  function changeMonth(delta) {
    const [y, m] = month.split("-").map(Number),
      d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function open(type = "expense", t) {
    setError("");
    setForm(
      t
        ? {
            ...t,
            amount: (t.amount / 100).toFixed(2).replace(".", ","),
            date: localDate(t.date),
          }
        : {
            type,
            amount: "",
            note: "",
            date: localDate(L.today()),
            account: data.accounts[0].id,
            to: data.accounts[1]?.id || "",
            category: type === "income" ? "Salário" : "Alimentação",
          },
    );
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await persist(L.saveTransaction(data, form, form.id));
      setForm(null);
      setNotice(
        form.id ? "Lançamento atualizado." : "Lançamento salvo no aparelho.",
      );
    } catch (e) {
      setError(e.message || "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  async function saveAccount() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const name = accountForm.name.trim();
      if (!name || name.length > 40)
        throw Error("Informe um nome de até 40 caracteres.");
      if (
        data.accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())
      )
        throw Error("Já existe uma conta com esse nome.");
      const opening =
        accountForm.amount.trim() &&
        !/^0+(?:,0{1,2})?$/.test(accountForm.amount.trim())
          ? L.parseAmount(accountForm.amount)
          : 0;
      await persist({
        ...data,
        accounts: [...data.accounts, { id: L.id(), name, opening }],
      });
      setAccountForm(null);
      setNotice("Conta criada.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function backup() {
    if (busy) return;
    setBusy(true);
    try {
      await exportData(data);
      setNotice("Arquivo de backup preparado. Guarde-o em um local seguro.");
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (busy) return;
    setBusy(true);
    try {
      const file = await importData();
      if (file) {
        const next = L.validate(file);
        setConfirm({
          title: "Substituir os dados atuais?",
          text: `O backup tem ${next.accounts.length} contas e ${next.transactions.length} lançamentos. A restauração substitui tudo. Exporte os dados atuais antes, se quiser guardá-los.`,
          action: async () => {
            await persist(next);
            setNotice("Backup restaurado.");
          },
        });
      }
    } catch (e) {
      setNotice(e.message || "Backup inválido.");
    } finally {
      setBusy(false);
    }
  }
  function demo() {
    const next = L.empty();
    next.transactions = [
      {
        id: "exemplo1",
        type: "income",
        amount: 320000,
        date: L.today(),
        account: "conta",
        to: null,
        category: "Salário",
        note: "Salário fictício",
      },
      {
        id: "exemplo2",
        type: "expense",
        amount: 4590,
        date: L.today(),
        account: "conta",
        to: null,
        category: "Alimentação",
        note: "Almoço de exemplo",
      },
      {
        id: "exemplo3",
        type: "expense",
        amount: 1800,
        date: L.today(),
        account: "carteira",
        to: null,
        category: "Transporte",
        note: "Transporte de exemplo",
      },
      {
        id: "exemplo4",
        type: "transfer",
        amount: 10000,
        date: L.today(),
        account: "conta",
        to: "carteira",
        category: "Transferência",
        note: "Dinheiro na carteira",
      },
    ];
    setConfirm({
      title: "Carregar demonstração?",
      text: "Isso substitui os dados atuais por quatro lançamentos fictícios. Use apenas para conhecer o app e tire um backup antes, se já tiver registros.",
      action: async () => {
        await persist(next);
        setMonth(L.today().slice(0, 7));
        setTab("Início");
        setNotice("Demonstração com dados fictícios.");
      },
    });
  }
  if (!data)
    return (
      <SafeAreaView style={s.loading}>
        {fatal ? (
          <>
            <Text style={s.title}>Seus dados primeiro.</Text>
            <Text style={s.muted}>{fatal}</Text>
            <Button label="Tentar novamente" onPress={load} />
          </>
        ) : (
          <>
            <ActivityIndicator color="#157E69" />
            <Text style={s.muted}>Abrindo seu Bolso…</Text>
          </>
        )}
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  const totals = L.summary(data, month),
    [year, m] = month.split("-").map(Number);
  const sorted = data.transactions
    .filter((t) => t.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const visible = sorted.filter(
    (t) =>
      (filter === "Todos" || t.type === filter) &&
      `${t.note} ${t.category} ${data.accounts.find((a) => a.id === t.account)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const accountName = (id) =>
    data.accounts.find((a) => a.id === id)?.name || "";
  function row(t) {
    const expense = t.type === "expense",
      transfer = t.type === "transfer";
    return (
      <Pressable
        key={t.id}
        accessibilityRole="button"
        accessibilityLabel={`Editar ${t.note || t.category}, ${L.money(t.amount)}`}
        onPress={() => open(t.type, t)}
        style={s.row}
      >
        <View
          style={[
            s.txIcon,
            {
              backgroundColor: transfer
                ? "#ECECF5"
                : expense
                  ? "#FFF0E9"
                  : "#E4F3EC",
            },
          ]}
        >
          <Text
            style={{ fontSize: 21, color: expense ? "#B85E3C" : "#157E69" }}
          >
            {transfer ? "⇄" : expense ? "↗" : "↙"}
          </Text>
        </View>
        <View style={s.txInfo}>
          <Text numberOfLines={1} style={s.txTitle}>
            {t.note || t.category}
          </Text>
          <Text style={s.small}>
            {transfer
              ? `${accountName(t.account)} → ${accountName(t.to)}`
              : `${t.category} · ${accountName(t.account)}`}{" "}
            · {t.date.slice(8)}/{t.date.slice(5, 7)}
          </Text>
        </View>
        <Text
          style={[
            s.amount,
            { color: transfer ? "#73728C" : expense ? "#AF583C" : "#157E69" },
          ]}
        >
          {transfer ? "" : expense ? "−" : "+"}
          {L.money(t.amount)}
        </Text>
      </Pressable>
    );
  }
  const monthPicker = (
    <View style={s.monthPicker}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mês anterior"
        onPress={() => changeMonth(-1)}
        style={s.arrow}
      >
        <Text style={s.arrowText}>‹</Text>
      </Pressable>
      <Text style={s.monthTitle}>
        {months[m - 1]} <Text style={s.muted}>{year}</Text>
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Próximo mês"
        onPress={() => changeMonth(1)}
        style={s.arrow}
      >
        <Text style={s.arrowText}>›</Text>
      </Pressable>
    </View>
  );
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.app}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>
              bolso<Text style={{ color: "#ED956E" }}>.</Text>
            </Text>
            <Text style={s.tagline}>Seu dinheiro, com clareza.</Text>
          </View>
          <View style={s.local}>
            <Text style={s.localText}>● Só no aparelho</Text>
          </View>
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          {tab === "Início" && (
            <>
              {monthPicker}
              <View style={s.balance}>
                <Text style={s.balanceLabel}>SALDO TOTAL ATUAL</Text>
                <Text style={s.balanceValue}>{L.money(totals.total)}</Text>
                <Text style={s.balanceHint}>
                  Soma de todas as contas · até hoje
                </Text>
                <View style={s.balanceLine} />
                <View style={s.between}>
                  <View>
                    <Text style={s.balanceLabel}>↙ ENTRADAS DO MÊS</Text>
                    <Text style={s.incomeValue}>{L.money(totals.income)}</Text>
                  </View>
                  <View>
                    <Text style={s.balanceLabel}>↗ SAÍDAS DO MÊS</Text>
                    <Text style={s.expenseValue}>
                      {L.money(totals.expense)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={s.quick}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => open("expense")}
                  style={[s.quickButton, { backgroundColor: "#FAE8DE" }]}
                >
                  <Text style={s.quickGlyph}>−</Text>
                  <Text style={s.quickText}>Gasto</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => open("income")}
                  style={[s.quickButton, { backgroundColor: "#E1EFE6" }]}
                >
                  <Text style={s.quickGlyph}>+</Text>
                  <Text style={s.quickText}>Entrada</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => open("transfer")}
                  style={[s.quickButton, { backgroundColor: "#EAEAF2" }]}
                >
                  <Text style={s.quickGlyph}>⇄</Text>
                  <Text style={s.quickText}>Transferir</Text>
                </Pressable>
              </View>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>O mês em perspectiva</Text>
              </View>
              <View style={s.card}>
                <Text style={s.muted}>Entradas menos saídas</Text>
                <Text
                  style={[
                    s.net,
                    { color: totals.net < 0 ? "#AF583C" : "#157E69" },
                  ]}
                >
                  {L.money(totals.net)}
                </Text>
                <Text style={s.small}>
                  Transferências não contam como receita ou despesa.
                </Text>
              </View>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Últimas movimentações</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setTab("Extrato")}
                >
                  <Text style={s.link}>Ver todas →</Text>
                </Pressable>
              </View>
              <View style={s.card}>
                {sorted.length ? (
                  sorted.slice(0, 5).map(row)
                ) : (
                  <View style={s.empty}>
                    <Text style={s.emptyTitle}>Um começo mais leve.</Text>
                    <Text style={s.muted}>
                      Registre uma entrada ou um gasto. O seu resumo aparece
                      aqui.
                    </Text>
                    <Button
                      label="Registrar primeiro gasto"
                      onPress={() => open("expense")}
                    />
                  </View>
                )}
              </View>
              {!!Object.keys(totals.categories).length && (
                <>
                  <Text style={s.sectionTitle}>Para onde foi?</Text>
                  <View style={s.card}>
                    {Object.entries(totals.categories)
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, value], i) => (
                        <View key={name} style={{ marginBottom: 18 }}>
                          <View style={s.between}>
                            <Text style={s.label}>{name}</Text>
                            <Text style={s.label}>{L.money(value)}</Text>
                          </View>
                          <View style={s.barTrack}>
                            <View
                              style={[
                                s.bar,
                                {
                                  width: `${(value / totals.expense) * 100}%`,
                                  backgroundColor: palette[i % palette.length],
                                },
                              ]}
                            />
                          </View>
                        </View>
                      ))}
                  </View>
                </>
              )}
            </>
          )}
          {tab === "Extrato" && (
            <>
              <Text style={s.eyebrow}>CADA MOVIMENTO CONTA</Text>
              <Text style={s.title}>Seu extrato.</Text>
              {monthPicker}
              <TextInput
                accessibilityLabel="Buscar movimentações"
                placeholder="Buscar descrição, categoria ou conta"
                style={s.input}
                value={search}
                onChangeText={setSearch}
              />
              <Chips
                values={[
                  { id: "Todos", name: "Todos" },
                  { id: "expense", name: "Gastos" },
                  { id: "income", name: "Entradas" },
                  { id: "transfer", name: "Transferências" },
                ]}
                value={filter}
                onChange={setFilter}
              />
              <View style={s.card}>
                {visible.length ? (
                  visible.map(row)
                ) : (
                  <View style={s.empty}>
                    <Text style={s.emptyTitle}>Nenhum movimento por aqui.</Text>
                    <Text style={s.muted}>
                      Tente outro mês ou registre um lançamento.
                    </Text>
                  </View>
                )}
              </View>
              <Button
                label="+ Novo lançamento"
                onPress={() => open("expense")}
              />
              <Text style={s.small}>
                Toque em um lançamento para editar ou excluir.
              </Text>
            </>
          )}
          {tab === "Contas" && (
            <>
              <Text style={s.eyebrow}>CADA VALOR NO SEU LUGAR</Text>
              <Text style={s.title}>Suas contas.</Text>
              <Text style={s.muted}>
                Controles manuais, sem conexão com bancos.
              </Text>
              {data.accounts.map((a, i) => (
                <View key={a.id} style={[s.card, s.between]}>
                  <View style={s.horizontal}>
                    <View
                      style={[
                        s.accountIcon,
                        { backgroundColor: palette[i % palette.length] },
                      ]}
                    >
                      <Text style={{ color: "white", fontSize: 21 }}>
                        {a.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={s.txTitle}>{a.name}</Text>
                      <Text style={s.small}>
                        Saldo inicial: {L.money(a.opening)}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.accountBalance}>
                    {L.money(totals.balances[a.id])}
                  </Text>
                </View>
              ))}
              <Button
                label="+ Adicionar conta"
                onPress={() => {
                  setError("");
                  setAccountForm({ name: "", amount: "" });
                }}
              />
              <Button
                label="Transferir entre contas"
                secondary
                onPress={() => open("transfer")}
              />
              <Text style={s.small}>
                Transferir muda os saldos das contas, sem alterar o saldo total.
                Saldos negativos são permitidos.
              </Text>
            </>
          )}
          {tab === "Ajustes" && (
            <>
              <Text style={s.eyebrow}>SEUS DADOS, SUAS ESCOLHAS</Text>
              <Text style={s.title}>Tudo com você.</Text>
              <View style={s.card}>
                <Text style={s.sectionTitle}>Sem cadastro. Sem servidor.</Text>
                <Text style={s.muted}>
                  Seus registros ficam no armazenamento deste aparelho. O app
                  não conecta contas bancárias, não usa IA e não envia seus
                  gastos para um servidor.
                </Text>
              </View>
              <View style={s.card}>
                <Text style={s.sectionTitle}>Uma cópia para guardar</Text>
                <Text style={s.muted}>
                  Faça backups regularmente. Desinstalar o app ou limpar seus
                  dados pode apagar seus registros. O arquivo exportado contém
                  seus valores e descrições, sem criptografia.
                </Text>
                <Button
                  disabled={busy}
                  label="Exportar backup"
                  onPress={backup}
                />
                <Button
                  disabled={busy}
                  secondary
                  label="Restaurar um backup"
                  onPress={restore}
                />
                <Text style={s.small}>
                  Ao exportar, você escolhe onde guardar ou compartilhar o
                  arquivo. Restaurar substitui os dados atuais.
                </Text>
              </View>
              <View style={s.card}>
                <Text style={s.sectionTitle}>Conheça sem compromisso</Text>
                <Text style={s.muted}>
                  Carregue exemplos fictícios para explorar as telas. Eles
                  substituem os registros atuais após confirmação.
                </Text>
                <Button
                  disabled={busy}
                  secondary
                  label="Carregar demonstração"
                  onPress={demo}
                />
              </View>
              <Text style={[s.small, { textAlign: "center" }]}>
                Bolso · v0.1.0 · Open source (MIT){"\n"}Feito para o dia a dia.
                Valores em reais.
              </Text>
            </>
          )}
        </ScrollView>
        {!!notice && (
          <View accessibilityRole="alert" style={s.notice}>
            <Text style={s.noticeText}>{notice}</Text>
          </View>
        )}
        <View style={s.nav}>
          {[
            ["Início", "⌂"],
            ["Extrato", "≡"],
            ["Contas", "▤"],
            ["Ajustes", "⚙"],
          ].map(([name, glyph]) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: tab === name }}
              key={name}
              onPress={() => setTab(name)}
              style={[s.navItem, tab === name && s.navActive]}
            >
              <Text style={[s.navGlyph, tab === name && s.active]}>
                {glyph}
              </Text>
              <Text style={[s.navText, tab === name && s.active]}>{name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Modal
        visible={!!form || !!accountForm}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) {
            setForm(null);
            setAccountForm(null);
          }
        }}
      >
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView
            style={s.app}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={s.modalHeader}>
              <Text style={s.sectionTitle}>
                {accountForm
                  ? "Nova conta"
                  : form?.id
                    ? "Editar lançamento"
                    : "Novo lançamento"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar formulário"
                disabled={busy}
                onPress={() => {
                  setForm(null);
                  setAccountForm(null);
                }}
                style={s.arrow}
              >
                <Text style={s.arrowText}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
            >
              {form && (
                <>
                  <Chips
                    values={[
                      { id: "expense", name: "Gasto" },
                      { id: "income", name: "Entrada" },
                      { id: "transfer", name: "Transferência" },
                    ]}
                    value={form.type}
                    onChange={(type) =>
                      setForm({
                        ...form,
                        type,
                        category:
                          type === "income"
                            ? "Salário"
                            : type === "transfer"
                              ? "Transferência"
                              : "Alimentação",
                      })
                    }
                  />
                  <Text style={s.eyebrow}>VALOR EM REAIS</Text>
                  <View style={s.valueInput}>
                    <Text style={s.currency}>R$</Text>
                    <TextInput
                      accessibilityLabel="Valor"
                      autoFocus
                      keyboardType="decimal-pad"
                      placeholder="0,00"
                      style={s.bigInput}
                      value={form.amount}
                      maxLength={18}
                      onChangeText={(amount) => setForm({ ...form, amount })}
                    />
                  </View>
                  <Text style={s.label}>
                    {form.type === "transfer" ? "Da conta" : "Conta"}
                  </Text>
                  <Chips
                    values={data.accounts}
                    value={form.account}
                    onChange={(account) => setForm({ ...form, account })}
                  />
                  {form.type === "transfer" ? (
                    <>
                      <Text style={s.label}>Para a conta</Text>
                      <Chips
                        values={data.accounts.filter(
                          (a) => a.id !== form.account,
                        )}
                        value={form.to}
                        onChange={(to) => setForm({ ...form, to })}
                      />
                      <Text style={s.small}>
                        Escolha contas diferentes. Não conta como gasto.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={s.label}>Categoria</Text>
                      <Chips
                        values={
                          form.type === "income"
                            ? ["Salário", "Extra", "Reembolso", "Outros"]
                            : L.CATEGORIES
                        }
                        value={form.category}
                        onChange={(category) => setForm({ ...form, category })}
                      />
                    </>
                  )}
                  <Field
                    label="Descrição (opcional)"
                    placeholder="Ex.: almoço, salário, mercado…"
                    value={form.note}
                    maxLength={120}
                    onChangeText={(note) => setForm({ ...form, note })}
                  />
                  <Field
                    label="Data (DD/MM/AAAA)"
                    placeholder="DD/MM/AAAA"
                    value={form.date}
                    maxLength={10}
                    keyboardType="numbers-and-punctuation"
                    onChangeText={(date) => setForm({ ...form, date })}
                  />
                  {!!error && (
                    <Text accessibilityRole="alert" style={s.error}>
                      {error}
                    </Text>
                  )}
                  <Button
                    disabled={busy}
                    label={
                      busy
                        ? "Salvando…"
                        : form.id
                          ? "Salvar alterações"
                          : "Salvar lançamento"
                    }
                    onPress={submit}
                  />
                  {form.id && (
                    <Button
                      disabled={busy}
                      danger
                      label="Excluir lançamento"
                      onPress={() =>
                        setConfirm({
                          title: "Excluir este lançamento?",
                          text: "Os saldos serão recalculados. Esta exclusão não pode ser desfeita no app.",
                          action: async () => {
                            await persist({
                              ...data,
                              transactions: data.transactions.filter(
                                (t) => t.id !== form.id,
                              ),
                            });
                            setForm(null);
                            setNotice("Lançamento excluído.");
                          },
                        })
                      }
                    />
                  )}
                </>
              )}
              {accountForm && (
                <>
                  <Text style={s.muted}>
                    Crie um lugar para organizar seu dinheiro. O saldo inicial
                    não entra como receita do mês.
                  </Text>
                  <Field
                    label="Nome da conta"
                    value={accountForm.name}
                    maxLength={40}
                    placeholder="Ex.: Reserva"
                    onChangeText={(name) =>
                      setAccountForm({ ...accountForm, name })
                    }
                  />
                  <Field
                    label="Saldo inicial (opcional)"
                    value={accountForm.amount}
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    onChangeText={(amount) =>
                      setAccountForm({ ...accountForm, amount })
                    }
                  />
                  {!!error && (
                    <Text accessibilityRole="alert" style={s.error}>
                      {error}
                    </Text>
                  )}
                  <Button
                    disabled={busy}
                    label={busy ? "Salvando…" : "Criar conta"}
                    onPress={saveAccount}
                  />
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!confirm}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setConfirm(null)}
      >
        <View style={s.overlay}>
          <View style={s.confirmCard}>
            <Text style={s.sectionTitle}>{confirm?.title}</Text>
            <Text style={s.muted}>{confirm?.text}</Text>
            <Button
              disabled={busy}
              label={busy ? "Aguarde…" : "Confirmar"}
              onPress={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  await confirm.action();
                  setConfirm(null);
                } catch (e) {
                  setNotice(e.message || "Não foi possível concluir.");
                  setConfirm(null);
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button
              disabled={busy}
              secondary
              label="Cancelar"
              onPress={() => setConfirm(null)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8F2" },
  app: { flex: 1, width: "100%", maxWidth: 600, alignSelf: "center" },
  loading: {
    flex: 1,
    padding: 28,
    justifyContent: "center",
    gap: 20,
    backgroundColor: "#F7F8F2",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    fontSize: 37,
    fontWeight: "800",
    letterSpacing: -2,
    color: "#153C36",
  },
  tagline: { fontSize: 12, color: "#78867C", marginTop: 1 },
  local: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#E7EFE4",
    borderRadius: 20,
  },
  localText: { fontSize: 10, color: "#42765E", fontWeight: "600" },
  content: { paddingHorizontal: 22, paddingBottom: 30, gap: 16 },
  monthPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  monthTitle: { fontSize: 16, fontWeight: "700", color: "#153C36" },
  arrow: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { fontSize: 29, color: "#31554C" },
  balance: { backgroundColor: "#173E37", padding: 25, borderRadius: 26 },
  balanceLabel: {
    color: "#B3C8B9",
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "600",
  },
  balanceValue: {
    color: "#F8FAEB",
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -1,
    marginTop: 12,
  },
  balanceHint: { color: "#ABC2B4", fontSize: 11, marginTop: 9 },
  balanceLine: { height: 1, backgroundColor: "#36584C", marginVertical: 22 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  incomeValue: {
    fontSize: 18,
    color: "#C4E1CA",
    fontWeight: "600",
    marginTop: 7,
  },
  expenseValue: {
    fontSize: 18,
    color: "#F2BD9F",
    fontWeight: "600",
    marginTop: 7,
  },
  quick: { flexDirection: "row", gap: 12 },
  quickButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    gap: 3,
  },
  quickGlyph: { fontSize: 25, color: "#23493F" },
  quickText: { fontSize: 12, fontWeight: "700", color: "#23493F" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C3E34",
    marginBottom: 4,
  },
  link: { color: "#157E69", fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 19,
    borderWidth: 1,
    borderColor: "#E7EBE1",
    gap: 8,
  },
  muted: { fontSize: 14, color: "#78867C", lineHeight: 22 },
  small: { fontSize: 11, color: "#859086", lineHeight: 17 },
  net: { fontSize: 26, fontWeight: "700", marginVertical: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3ED",
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: { flex: 1, gap: 5 },
  txTitle: { fontSize: 13, fontWeight: "600", color: "#25463B" },
  amount: { fontSize: 12, fontWeight: "700" },
  empty: { paddingVertical: 14, gap: 15 },
  emptyTitle: { fontSize: 18, color: "#264B3E", fontWeight: "600" },
  barTrack: {
    height: 6,
    backgroundColor: "#F0F2EB",
    borderRadius: 4,
    marginTop: 9,
    overflow: "hidden",
  },
  bar: { height: 6, borderRadius: 4 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: "#809080",
    fontWeight: "600",
    marginTop: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#173E37",
    letterSpacing: -0.8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DCE4D7",
    borderRadius: 13,
    padding: 15,
    fontSize: 15,
    color: "#254638",
    backgroundColor: "#FFFFFF",
    minHeight: 50,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 9 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 20,
    backgroundColor: "#EDF0E8",
    minHeight: 42,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "#173E37" },
  chipText: { fontSize: 12, color: "#6B7E6F" },
  chipTextActive: { color: "#F5F7EB", fontWeight: "600" },
  button: {
    backgroundColor: "#157E69",
    borderRadius: 14,
    padding: 17,
    alignItems: "center",
    marginTop: 6,
    minHeight: 52,
  },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  secondary: { backgroundColor: "#E9EFE4" },
  danger: { backgroundColor: "#AE513E" },
  field: { gap: 9, marginTop: 5 },
  label: { fontSize: 13, fontWeight: "600", color: "#3F5847" },
  accountIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  horizontal: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  accountBalance: { fontSize: 16, fontWeight: "700", color: "#264B3E" },
  notice: {
    padding: 14,
    marginHorizontal: 15,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: "#234C3F",
  },
  noticeText: { color: "white", fontSize: 13, lineHeight: 20 },
  nav: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#E5EADD",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 7,
    borderRadius: 14,
  },
  navActive: { backgroundColor: "#F0F4EA" },
  navGlyph: { fontSize: 23, color: "#8F9B8D" },
  navText: { fontSize: 10, color: "#8F9B8D" },
  active: { color: "#157E69", fontWeight: "700" },
  modalHeader: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  valueInput: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#CFD9CB",
    paddingBottom: 12,
    marginBottom: 12,
  },
  currency: { fontSize: 26, color: "#8A9C88" },
  bigInput: {
    flex: 1,
    fontSize: 43,
    fontWeight: "600",
    color: "#173E37",
    paddingVertical: 10,
  },
  error: { color: "#AC4D39", fontSize: 14, lineHeight: 21 },
  overlay: {
    flex: 1,
    backgroundColor: "#153C3699",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 430,
    padding: 25,
    backgroundColor: "#F7F8F2",
    borderRadius: 24,
    gap: 14,
  },
});
