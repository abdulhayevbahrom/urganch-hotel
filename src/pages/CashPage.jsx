import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Tabs,
  Tag,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  FiCheckCircle,
  FiClock,
  FiSend,
  FiXCircle,
} from "react-icons/fi";
import {
  useCloseCashMutation,
  useDecideCashClosureMutation,
  useAddGuestPaymentMutation,
  useGetCashSummaryQuery,
  useGetDailyCashControlQuery,
  useGetGuestsQuery,
} from "../store/employeeApi";
import PageLoader from "../components/PageLoader";
import {
  acquireSocketConnection,
  releaseSocketConnection,
} from "../config/socketConfig";
import {
  blockNonIntegerKeys,
  preventInvalidAmountPaste,
} from "../utils/numberFormat";
import "./cash.css";

const formatMoney = (value) => Number(value || 0).toLocaleString("uz-UZ");
const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("uz-UZ");
};

const paymentTypeLabel = {
  naqd: "Naqd",
  karta: "Karta",
  click: "Click",
  bank: "Bank",
};

const sourceTypeLabel = {
  guest: "Mehmon",
  group: "Guruh",
  hall: "Zal",
};

const statusColor = {
  submitted: "gold",
  approved: "green",
  rejected: "red",
};

const statusLabel = {
  submitted: "Tasdiq kutmoqda",
  approved: "Tasdiqlangan",
  rejected: "Qaytarilgan",
};

const formatActor = (actor) => {
  const name = `${actor?.firstname || ""} ${actor?.lastname || ""}`.trim();
  return name || actor?.login || "-";
};

function CashPage() {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const isCashier = String(user?.role || "").toLowerCase().trim() === "kassir";
  const canViewDailyControl = ["owner", "admin"].includes(
    String(user?.role || "").toLowerCase().trim(),
  );
  const [form] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [decisionForm] = Form.useForm();
  const paymentParts = Form.useWatch("payments", paymentForm) || {};
  const [closingOpen, setClosingOpen] = useState(false);
  const [paymentGuest, setPaymentGuest] = useState(null);
  const [decision, setDecision] = useState(null);
  const [openPage, setOpenPage] = useState(1);
  const [debtorPage, setDebtorPage] = useState(1);
  const [debtorQuery, setDebtorQuery] = useState("");
  const [controlDate, setControlDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }),
  );
  const [controlCashierId, setControlCashierId] = useState("");
  const [controlPage, setControlPage] = useState(1);
  const { data, isLoading, refetch } = useGetCashSummaryQuery(
    { page: openPage, limit: 50 },
    { pollingInterval: 15000, refetchOnFocus: true, refetchOnReconnect: true },
  );
  const {
    data: debtorsData,
    isLoading: debtorsLoading,
    refetch: refetchDebtors,
  } = useGetGuestsQuery({
    tab: "debtors",
    page: debtorPage,
    limit: 20,
    query: debtorQuery,
  });
  const {
    data: dailyControlData,
    isFetching: dailyControlLoading,
    refetch: refetchDailyControl,
  } =
    useGetDailyCashControlQuery(
      {
        date: controlDate,
        cashierId: controlCashierId,
        page: controlPage,
        limit: 50,
      },
      {
        skip: !canViewDailyControl,
        pollingInterval: 15000,
        refetchOnFocus: true,
      },
    );

  useEffect(() => {
    if (!token) return undefined;
    const socket = acquireSocketConnection(token);
    if (!socket) return undefined;

    const handleCashUpdated = () => {
      refetch();
      refetchDebtors();
      if (canViewDailyControl) refetchDailyControl();
    };

    socket.on("cash_updated", handleCashUpdated);
    socket.on("guest_updated", handleCashUpdated);
    return () => {
      socket.off("cash_updated", handleCashUpdated);
      socket.off("guest_updated", handleCashUpdated);
      releaseSocketConnection(socket);
    };
  }, [
    canViewDailyControl,
    refetch,
    refetchDailyControl,
    refetchDebtors,
    token,
  ]);
  const [closeCash, { isLoading: closing }] = useCloseCashMutation();
  const [addGuestPayment, { isLoading: addingPayment }] =
    useAddGuestPaymentMutation();
  const [decideClosure, { isLoading: deciding }] =
    useDecideCashClosureMutation();

  const payload = data?.innerData || {};
  const open = payload.open || {};
  const totals = open.totals || {};
  const transactions = Array.isArray(open.transactions)
    ? open.transactions
    : [];
  const submitted = Array.isArray(payload.submitted) ? payload.submitted : [];
  const recentClosures = Array.isArray(payload.recentClosures)
    ? payload.recentClosures
    : [];
  const canApprove = Boolean(payload.canApprove);
  const cashierSummaries = Array.isArray(payload.cashierSummaries)
    ? payload.cashierSummaries
    : [];
  const openPagination = open.pagination || {};
  const debtorPagination = debtorsData?.innerData?.pagination || {};
  const debtors = Array.isArray(debtorsData?.innerData?.items)
    ? debtorsData.innerData.items
    : [];
  const dailyControl = dailyControlData?.innerData || {};
  const dailyCashiers = Array.isArray(dailyControl.summaries)
    ? dailyControl.summaries
    : [];
  const dailyTransactions = Array.isArray(dailyControl.transactions)
    ? dailyControl.transactions
    : [];
  const dailyPagination = dailyControl.pagination || {};
  const selectedDailyCashier = dailyCashiers.find(
    (item) => String(item._id) === String(controlCashierId),
  );
  const splitPaymentTotal = ["naqd", "karta", "click", "bank"].reduce(
    (sum, type) => sum + Number(paymentParts[type] || 0),
    0,
  );

  const displayedTotals = useMemo(() => {
    if (!canApprove) return totals;
    return cashierSummaries.reduce(
      (result, item) => ({
        naqd: result.naqd + Number(item.naqd || 0),
        karta: result.karta + Number(item.karta || 0),
        click: result.click + Number(item.click || 0),
        bank: result.bank + Number(item.bank || 0),
        total: result.total + Number(item.total || 0),
      }),
      { naqd: 0, karta: 0, click: 0, bank: 0, total: 0 },
    );
  }, [canApprove, cashierSummaries, totals]);

  const totalCards = useMemo(
    () => [
      { label: canApprove ? "Barchasi" : "Mening kassam", value: displayedTotals.total },
      { label: "Naqd", value: displayedTotals.naqd },
      { label: "Karta", value: displayedTotals.karta },
      { label: "Click", value: displayedTotals.click },
      { label: "Bank", value: displayedTotals.bank },
    ],
    [canApprove, displayedTotals],
  );

  const openCloseModal = () => {
    form.setFieldsValue({
      countedCash: Number(totals.naqd || 0),
      note: "",
    });
    setClosingOpen(true);
  };

  const submitClose = async (values) => {
    try {
      const result = await closeCash({
        countedCash: Number(values.countedCash || 0),
        note: String(values.note || "").trim(),
      }).unwrap();
      toast.success(result?.message || "Kassa yopildi");
      setClosingOpen(false);
      form.resetFields();
    } catch (error) {
      toast.error(error?.data?.message || "Kassani yopishda xatolik");
    }
  };

  const openPaymentModal = (guest) => {
    setPaymentGuest(guest);
    paymentForm.setFieldsValue({
      payments: {
        naqd: Number(guest?.debtAmount || 0),
        karta: 0,
        click: 0,
        bank: 0,
      },
      note: "",
    });
  };

  const submitPayment = async (values) => {
    const payments = ["naqd", "karta", "click", "bank"]
      .map((type) => ({ type, amount: Number(values.payments?.[type] || 0) }))
      .filter((item) => item.amount > 0);
    const total = payments.reduce((sum, item) => sum + item.amount, 0);
    if (!total) {
      toast.error("Kamida bitta to'lov usuliga summa kiriting");
      return;
    }
    if (total > Number(paymentGuest?.debtAmount || 0)) {
      toast.error("Jami to'lov mijoz qarzidan oshmasligi kerak");
      return;
    }
    try {
      const result = await addGuestPayment({
        id: paymentGuest._id,
        payments,
        note: String(values.note || "").trim(),
      }).unwrap();
      toast.success(result?.message || "To'lov qabul qilindi");
      setPaymentGuest(null);
      paymentForm.resetFields();
    } catch (error) {
      toast.error(error?.data?.message || "To'lovda xatolik");
    }
  };

  const openDecisionModal = (closure, action) => {
    setDecision({ closure, action });
    decisionForm.setFieldsValue({ adminNote: "" });
  };

  const submitDecision = async (values) => {
    try {
      const result = await decideClosure({
        id: decision.closure._id,
        action: decision.action,
        adminNote: String(values.adminNote || "").trim(),
      }).unwrap();
      toast.success(result?.message || "Kassa ko'rib chiqildi");
      setDecision(null);
      decisionForm.resetFields();
    } catch (error) {
      toast.error(error?.data?.message || "Tasdiqlashda xatolik");
    }
  };

  if (isLoading) return <PageLoader text="Kassa ma'lumotlari tayyorlanmoqda" />;

  return (
    <div className="employee-page cash-page">
      <div className="page-card">
        {isCashier ? (
          <div className="table-toolbar cash-toolbar">
            <div className="toolbar-actions">
              <Button
                className="hotel-primary-btn"
                icon={<FiSend />}
                disabled={!Number(open.count || 0)}
                onClick={openCloseModal}
              >
                Kassani yopish
              </Button>
            </div>
          </div>
        ) : null}

        <div className="cash-summary-grid">
          {totalCards.map((item) => (
            <div className="cash-summary-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{formatMoney(item.value)} so'm</strong>
            </div>
          ))}
        </div>

        <Tabs
          className="cash-tabs"
          items={[
            ...(canApprove
              ? [
                  {
                    key: "owner-open",
                    label: `Ochiq kassalar (${cashierSummaries.length})`,
                    children: (
                      <section className="cash-section">
                        <div className="cash-section-head">
                          <h3>Owner nazorati: ochiq kassalar</h3>
                          <span>{cashierSummaries.length} ta kassir</span>
                        </div>
                        <div className="table-wrap">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Kassir</th>
                                <th>To'lovlar</th>
                                <th>Naqd</th>
                                <th>Karta</th>
                                <th>Click</th>
                                <th>Bank</th>
                                <th>Jami</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cashierSummaries.map((item) => (
                                <tr key={item._id || formatActor(item.cashier)}>
                                  <td>{formatActor(item.cashier)}</td>
                                  <td>{Number(item.count || 0)} ta</td>
                                  <td>{formatMoney(item.naqd)} so'm</td>
                                  <td>{formatMoney(item.karta)} so'm</td>
                                  <td>{formatMoney(item.click)} so'm</td>
                                  <td>{formatMoney(item.bank)} so'm</td>
                                  <td><b>{formatMoney(item.total)} so'm</b></td>
                                </tr>
                              ))}
                              {!cashierSummaries.length ? (
                                <tr>
                                  <td className="table-empty" colSpan={7}>
                                    Ochiq kassalar yo'q
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ),
                  },
                ]
              : []),
            {
              key: "payments",
              label: isCashier ? "To'lov olish" : "Qarzdorlar",
              children: (
                <section className="cash-section">
                  <div className="cash-section-head">
                    <h3>To'lov qabul qilish</h3>
                    <span>{Number(debtorPagination.total || 0)} ta qarzdor mijoz</span>
                  </div>
                  <Input.Search
                    allowClear
                    placeholder="Ism, familiya, xona, INN yoki tashkilot"
                    value={debtorQuery}
                    onChange={(event) => {
                      setDebtorQuery(event.target.value);
                      setDebtorPage(1);
                    }}
                    style={{ maxWidth: 420, marginBottom: 12 }}
                  />
                  {!isCashier ? (
                    <div className="cash-empty-panel" style={{ marginBottom: 12 }}>
                      Qarzdorlar bo'yicha to'lovni faqat kassir profilidan qabul qilish mumkin.
                    </div>
                  ) : null}
                  <div className="table-wrap">
                    <table className="table">
              <thead>
                <tr>
                  <th>Mijoz</th>
                  <th>Xona</th>
                  <th>Jami</th>
                  <th>To'langan</th>
                  <th>Qarz</th>
                  {isCashier ? <th>Amal</th> : null}
                </tr>
              </thead>
              <tbody>
                {debtors.map((guest) => (
                  <tr key={guest._id}>
                    <td data-label="Mijoz">
                      {guest.firstname} {guest.lastname}
                    </td>
                    <td data-label="Xona">{guest.room?.roomNumber || "-"}</td>
                    <td data-label="Jami">
                      {formatMoney(guest.totalAmount)} so'm
                    </td>
                    <td data-label="To'langan">
                      {formatMoney(guest.paidAmount)} so'm
                    </td>
                    <td data-label="Qarz">
                      {formatMoney(guest.debtAmount)} so'm
                    </td>
                    {isCashier ? (
                      <td data-label="Amal">
                        <Button
                          className="hotel-primary-btn"
                          onClick={() => openPaymentModal(guest)}
                        >
                          To'lov olish
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {!debtors.length ? (
                  <tr>
                    <td className="table-empty" colSpan={isCashier ? 6 : 5}>
                      {debtorsLoading
                        ? "Qarzdorlar yuklanmoqda"
                        : "Qarzdor mijozlar yo'q"}
                    </td>
                  </tr>
                ) : null}
              </tbody>
                    </table>
                  </div>
                  {Number(debtorPagination.total || 0) > 20 ? (
                    <Pagination
                      current={Number(debtorPagination.page || debtorPage)}
                      pageSize={20}
                      total={Number(debtorPagination.total || 0)}
                      showSizeChanger={false}
                      onChange={setDebtorPage}
                      style={{ marginTop: 12 }}
                    />
                  ) : null}
                </section>
              ),
            },
            {
              key: "open",
              label: `Ochiq kassa (${Number(open.count || 0)})`,
              children: (
                <section className="cash-section">
                  <div className="cash-section-head">
                    <h3>Ochiq to'lovlar</h3>
                    <span>{Number(open.count || 0)} ta to'lov</span>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
              <thead>
                <tr>
                  <th>Sana</th>
                  <th>Manba</th>
                  <th>Nomi</th>
                  <th>To'lov turi</th>
                  <th>Summa</th>
                  <th>Kassir</th>
                  <th>Izoh</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((item) => (
                  <tr key={item._id}>
                    <td data-label="Sana">{formatDateTime(item.paidAt)}</td>
                    <td data-label="Manba">
                      {sourceTypeLabel[item.sourceType] || item.sourceType}
                    </td>
                    <td data-label="Nomi">{item.title}</td>
                    <td data-label="To'lov turi">
                      {paymentTypeLabel[item.paymentType] || item.paymentType}
                    </td>
                    <td data-label="Summa">
                      {formatMoney(item.amount)} so'm
                    </td>
                    <td data-label="Kassir">{formatActor(item.cashier)}</td>
                    <td data-label="Izoh">{item.note || "-"}</td>
                  </tr>
                ))}
                {!transactions.length ? (
                  <tr>
                    <td className="table-empty" colSpan={7}>
                      Ochiq to'lovlar yo'q
                    </td>
                  </tr>
                ) : null}
              </tbody>
                    </table>
                  </div>
                  {Number(openPagination.total || 0) > Number(openPagination.limit || 50) ? (
                    <Pagination
                      current={Number(openPagination.page || openPage)}
                      pageSize={Number(openPagination.limit || 50)}
                      total={Number(openPagination.total || 0)}
                      showSizeChanger={false}
                      onChange={setOpenPage}
                      style={{ marginTop: 12 }}
                    />
                  ) : null}
                </section>
              ),
            },
            ...(canViewDailyControl
              ? [
                  {
                    key: "daily-control",
                    label: "Kunlik nazorat",
                    children: (
                      <section className="cash-section">
                        <div className="cash-section-head cash-daily-control-head">
                          <div>
                            <h3>Kassirlarning kunlik to'lovlari</h3>
                            <span>
                              {dailyControl.range?.start && dailyControl.range?.end
                                ? `${formatDateTime(dailyControl.range.start)} — ${formatDateTime(dailyControl.range.end)}`
                                : "Sana bo'yicha nazorat"}
                            </span>
                          </div>
                          <label className="cash-date-filter">
                            <span>Sana</span>
                            <DatePicker
                              allowClear={false}
                              value={dayjs(controlDate, "YYYY-MM-DD")}
                              format="DD.MM.YYYY"
                              placeholder="Sanani tanlang"
                              disabledDate={(current) =>
                                Boolean(
                                  current &&
                                    current.startOf("day").isAfter(dayjs().startOf("day")),
                                )
                              }
                              onChange={(date) => {
                                if (!date) return;
                                setControlDate(date.format("YYYY-MM-DD"));
                                setControlCashierId("");
                                setControlPage(1);
                              }}
                            />
                          </label>
                        </div>

                        <div className="table-wrap">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Kassir</th>
                                <th>To'lovlar</th>
                                <th>Naqd</th>
                                <th>Karta</th>
                                <th>Click</th>
                                <th>Bank</th>
                                <th>Jami</th>
                                <th>Amal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dailyCashiers.map((item) => (
                                <tr
                                  key={item._id || formatActor(item.cashier)}
                                  className={
                                    String(item._id) === String(controlCashierId)
                                      ? "cash-selected-row"
                                      : ""
                                  }
                                >
                                  <td>{formatActor(item.cashier)}</td>
                                  <td>{Number(item.count || 0)} ta</td>
                                  <td>{formatMoney(item.naqd)} so'm</td>
                                  <td>{formatMoney(item.karta)} so'm</td>
                                  <td>{formatMoney(item.click)} so'm</td>
                                  <td>{formatMoney(item.bank)} so'm</td>
                                  <td><b>{formatMoney(item.total)} so'm</b></td>
                                  <td>
                                    <Button
                                      type="primary"
                                      danger={
                                        String(item._id) === String(controlCashierId)
                                      }
                                      className="cash-control-toggle"
                                      icon={
                                        String(item._id) === String(controlCashierId)
                                          ? <FiXCircle />
                                          : undefined
                                      }
                                      onClick={() => {
                                        const isSelected =
                                          String(item._id) === String(controlCashierId);
                                        setControlCashierId(
                                          isSelected ? "" : String(item._id || ""),
                                        );
                                        setControlPage(1);
                                      }}
                                    >
                                      {String(item._id) === String(controlCashierId)
                                        ? "Yopish"
                                        : "To'lovlarni ko'rish"}
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                              {!dailyCashiers.length ? (
                                <tr>
                                  <td className="table-empty" colSpan={8}>
                                    {dailyControlLoading
                                      ? "Kunlik ma'lumotlar yuklanmoqda"
                                      : "Tanlangan kunda kassir to'lovlari yo'q"}
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>

                        {controlCashierId ? (
                          <div className="cash-daily-details">
                            <div className="cash-section-head">
                              <h3>
                                {formatActor(selectedDailyCashier?.cashier)} — to'lovlar ro'yxati
                              </h3>
                              <span>{Number(dailyPagination.total || 0)} ta to'lov</span>
                            </div>
                            <div className="table-wrap">
                              <table className="table">
                                <thead>
                                  <tr>
                                    <th>Vaqt</th>
                                    <th>Manba</th>
                                    <th>Mijoz / nomi</th>
                                    <th>To'lov turi</th>
                                    <th>Summa</th>
                                    <th>Holat</th>
                                    <th>Izoh</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dailyTransactions.map((item) => (
                                    <tr key={item._id}>
                                      <td>{formatDateTime(item.paidAt)}</td>
                                      <td>{sourceTypeLabel[item.sourceType] || item.sourceType}</td>
                                      <td>{item.title}</td>
                                      <td>{paymentTypeLabel[item.paymentType] || item.paymentType}</td>
                                      <td><b>{formatMoney(item.amount)} so'm</b></td>
                                      <td>
                                        <Tag color={statusColor[item.status] || "blue"}>
                                          {statusLabel[item.status] ||
                                            (item.status === "open" ? "Ochiq" : item.status)}
                                        </Tag>
                                      </td>
                                      <td>{item.note || "-"}</td>
                                    </tr>
                                  ))}
                                  {!dailyTransactions.length ? (
                                    <tr>
                                      <td className="table-empty" colSpan={7}>
                                        {dailyControlLoading
                                          ? "To'lovlar yuklanmoqda"
                                          : "To'lovlar topilmadi"}
                                      </td>
                                    </tr>
                                  ) : null}
                                </tbody>
                              </table>
                            </div>
                            {Number(dailyPagination.total || 0) >
                            Number(dailyPagination.limit || 50) ? (
                              <Pagination
                                current={Number(dailyPagination.page || controlPage)}
                                pageSize={Number(dailyPagination.limit || 50)}
                                total={Number(dailyPagination.total || 0)}
                                showSizeChanger={false}
                                onChange={setControlPage}
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    ),
                  },
                ]
              : []),
            ...(canApprove
              ? [
                  {
                    key: "approval",
                    label: `Tasdiqlash (${submitted.length})`,
                    children: (
                      <section className="cash-section">
                        <div className="cash-section-head">
                          <h3>Admin tasdiqlashi kerak</h3>
                          <span>{submitted.length} ta topshiriq</span>
                        </div>
                        {submitted.length ? (
                          <div className="cash-closure-grid">
                            {submitted.map((closure) => (
                              <article className="cash-closure-card" key={closure._id}>
                                <div>
                                  <b>{formatActor(closure.cashier)}</b>
                                  <small>{formatDateTime(closure.createdAt)}</small>
                                </div>
                                <strong>{formatMoney(closure.totals?.total)} so'm</strong>
                                <p>
                                  Naqd: {formatMoney(closure.totals?.naqd)} so'm / Sanalgan:{" "}
                                  {formatMoney(closure.countedCash)} so'm
                                </p>
                                <p>
                                  Karta: {formatMoney(closure.totals?.karta)} so'm / Click:{" "}
                                  {formatMoney(closure.totals?.click)} so'm / Bank:{" "}
                                  {formatMoney(closure.totals?.bank)} so'm
                                </p>
                                <p>Farq: {formatMoney(closure.difference)} so'm</p>
                                {closure.note ? <em>{closure.note}</em> : null}
                                <div className="cash-card-actions">
                                  <Button
                                    icon={<FiCheckCircle />}
                                    onClick={() => openDecisionModal(closure, "approve")}
                                  >
                                    Tasdiqlash
                                  </Button>
                                  <Button
                                    danger
                                    icon={<FiXCircle />}
                                    onClick={() => openDecisionModal(closure, "reject")}
                                  >
                                    Qaytarish
                                  </Button>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="cash-empty-panel">Tasdiqlash kutilayotgan kassa yo'q</div>
                        )}
                      </section>
                    ),
                  },
                ]
              : []),
            {
              key: "history",
              label: "Tarix",
              children: (
                <section className="cash-section">
                  <div className="cash-section-head">
                    <h3>Kassa tarixi</h3>
                    <span>{recentClosures.length} ta yozuv</span>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
              <thead>
                <tr>
                  <th>Sana</th>
                  <th>Kassir</th>
                  <th>Jami</th>
                  <th>Naqd</th>
                  <th>Karta</th>
                  <th>Click</th>
                  <th>Bank</th>
                  <th>Sanalgan</th>
                  <th>Farq</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {recentClosures.map((closure) => (
                  <tr key={closure._id}>
                    <td data-label="Sana">{formatDateTime(closure.createdAt)}</td>
                    <td data-label="Kassir">{formatActor(closure.cashier)}</td>
                    <td data-label="Jami">
                      {formatMoney(closure.totals?.total)} so'm
                    </td>
                    <td data-label="Naqd">
                      {formatMoney(closure.totals?.naqd)} so'm
                    </td>
                    <td data-label="Karta">
                      {formatMoney(closure.totals?.karta)} so'm
                    </td>
                    <td data-label="Click">
                      {formatMoney(closure.totals?.click)} so'm
                    </td>
                    <td data-label="Bank">
                      {formatMoney(closure.totals?.bank)} so'm
                    </td>
                    <td data-label="Sanalgan">
                      {formatMoney(closure.countedCash)} so'm
                    </td>
                    <td data-label="Farq">
                      {formatMoney(closure.difference)} so'm
                    </td>
                    <td data-label="Holat">
                      <Tag color={statusColor[closure.status] || "default"}>
                        {statusLabel[closure.status] || closure.status}
                      </Tag>
                    </td>
                  </tr>
                ))}
                {!recentClosures.length ? (
                  <tr>
                    <td className="table-empty" colSpan={10}>
                      Kassa tarixi yo'q
                    </td>
                  </tr>
                ) : null}
              </tbody>
                    </table>
                  </div>
                </section>
              ),
            },
          ]}
        />
      </div>

      <Modal
        open={closingOpen}
        onCancel={() => setClosingOpen(false)}
        footer={null}
        title="Kassani yopish"
        destroyOnHidden
        rootClassName="employee-modal-theme cash-modal-theme"
      >
        <Form form={form} layout="vertical" onFinish={submitClose}>
          <div className="cash-close-breakdown">
            <div><span>Naqd</span><b>{formatMoney(totals.naqd)} so'm</b></div>
            <div><span>Karta</span><b>{formatMoney(totals.karta)} so'm</b></div>
            <div><span>Click</span><b>{formatMoney(totals.click)} so'm</b></div>
            <div><span>Bank</span><b>{formatMoney(totals.bank)} so'm</b></div>
            <div className="cash-close-total">
              <span>Jami topshiriladi</span><b>{formatMoney(totals.total)} so'm</b>
            </div>
          </div>
          <p className="cash-close-help">
            Karta, Click va bank summalari avtomatik topshiriladi. Faqat qo'lingizdagi
            real naqd pulni sanab kiriting.
          </p>
          <Form.Item
            name="countedCash"
            label="Sanalgan naqd pul"
            rules={[{ required: true, message: "Naqd pul summasini kiriting" }]}
          >
            <InputNumber
              min={0}
              precision={0}
              style={{ width: "100%" }}
              formatter={(value) =>
                String(value || "").replace(/\B(?=(\d{3})+(?!\d))/g, " ")
              }
              parser={(value) => String(value || "").replace(/[^\d]/g, "")}
              onKeyDown={blockNonIntegerKeys}
              onPaste={preventInvalidAmountPaste}
            />
          </Form.Item>
          <Form.Item name="note" label="Izoh">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <div className="modal-actions">
            <Button onClick={() => setClosingOpen(false)}>Bekor</Button>
            <Popconfirm
              title="Kassani yopish"
              description="Ochiq to'lovlar adminga tasdiqlash uchun yuboriladi. Davom etasizmi?"
              okText="Yopish"
              cancelText="Bekor"
              onConfirm={() => form.submit()}
              overlayClassName="hotel-popconfirm"
            >
              <Button className="hotel-primary-btn" loading={closing}>
                Yopish
              </Button>
            </Popconfirm>
          </div>
        </Form>
      </Modal>

      <Modal
        open={Boolean(paymentGuest)}
        onCancel={() => setPaymentGuest(null)}
        footer={null}
        title="To'lov qabul qilish"
        destroyOnHidden
        rootClassName="employee-modal-theme cash-modal-theme"
      >
        <Form form={paymentForm} layout="vertical" onFinish={submitPayment}>
          <div className="cash-decision-note">
            <FiClock />
            <span>
              {paymentGuest?.firstname} {paymentGuest?.lastname} qarzi:{" "}
              {formatMoney(paymentGuest?.debtAmount)} so'm
            </span>
          </div>
          <div className="cash-split-payment-grid">
            {[
              ["naqd", "Naqd"],
              ["karta", "Karta"],
              ["click", "Click"],
              ["bank", "Bank"],
            ].map(([type, label]) => (
              <Form.Item key={type} name={["payments", type]} label={label}>
                <InputNumber
                  min={0}
                  max={Number(paymentGuest?.debtAmount || 0)}
                  precision={0}
                  style={{ width: "100%" }}
                  formatter={(value) =>
                    String(value || "").replace(/\B(?=(\d{3})+(?!\d))/g, " ")
                  }
                  parser={(value) => String(value || "").replace(/[^\d]/g, "")}
                  onKeyDown={blockNonIntegerKeys}
                  onPaste={preventInvalidAmountPaste}
                />
              </Form.Item>
            ))}
          </div>
          <div
            className={`cash-split-total ${
              splitPaymentTotal > Number(paymentGuest?.debtAmount || 0)
                ? "cash-split-total-error"
                : ""
            }`}
          >
            <span>Jami to'lov</span>
            <b>{formatMoney(splitPaymentTotal)} so'm</b>
            <small>
              To'lovdan keyingi qarz: {formatMoney(
                Math.max(
                  Number(paymentGuest?.debtAmount || 0) - splitPaymentTotal,
                  0,
                ),
              )} so'm
            </small>
          </div>
          <Form.Item name="note" label="Izoh">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <div className="modal-actions">
            <Button onClick={() => setPaymentGuest(null)}>Bekor</Button>
            <Button
              className="hotel-primary-btn"
              loading={addingPayment}
              onClick={() => paymentForm.submit()}
            >
              Qabul qilish
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        open={Boolean(decision)}
        onCancel={() => setDecision(null)}
        footer={null}
        title={decision?.action === "approve" ? "Kassani tasdiqlash" : "Kassani qaytarish"}
        destroyOnHidden
        rootClassName="employee-modal-theme cash-modal-theme"
      >
        <Form form={decisionForm} layout="vertical" onFinish={submitDecision}>
          <div className="cash-decision-note">
            <FiClock />
            <span>
              {formatActor(decision?.closure?.cashier)} topshirgan kassa:{" "}
              {formatMoney(decision?.closure?.totals?.total)} so'm
            </span>
          </div>
          <Form.Item name="adminNote" label="Admin izohi">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <div className="modal-actions">
            <Button onClick={() => setDecision(null)}>Bekor</Button>
            <Button
              className="hotel-primary-btn"
              danger={decision?.action === "reject"}
              loading={deciding}
              onClick={() => decisionForm.submit()}
            >
              {decision?.action === "approve" ? "Tasdiqlash" : "Qaytarish"}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default CashPage;
