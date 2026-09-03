import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Tabs,
  Tag,
} from "antd";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiSend,
  FiXCircle,
} from "react-icons/fi";
import {
  useCloseCashMutation,
  useDecideCashClosureMutation,
  useAddGuestPaymentMutation,
  useGetCashSummaryQuery,
  useGetGuestsQuery,
} from "../store/employeeApi";
import PageLoader from "../components/PageLoader";
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
  const [form] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [decisionForm] = Form.useForm();
  const [closingOpen, setClosingOpen] = useState(false);
  const [paymentGuest, setPaymentGuest] = useState(null);
  const [decision, setDecision] = useState(null);
  const { data, isLoading, refetch, isFetching } = useGetCashSummaryQuery();
  const { data: debtorsData, isLoading: debtorsLoading } = useGetGuestsQuery({
    tab: "debtors",
    page: 1,
    limit: 8,
  });
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
  const debtors = Array.isArray(debtorsData?.innerData?.items)
    ? debtorsData.innerData.items
    : [];

  const totalCards = useMemo(
    () => [
      { label: "Jami kassa", value: totals.total },
      { label: "Naqd", value: totals.naqd },
      { label: "Karta", value: totals.karta },
      { label: "Bank", value: totals.bank },
    ],
    [totals.bank, totals.karta, totals.naqd, totals.total],
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
      amount: Number(guest?.debtAmount || 0),
      type: "naqd",
      note: "",
    });
  };

  const submitPayment = async (values) => {
    try {
      const result = await addGuestPayment({
        id: paymentGuest._id,
        amount: Number(values.amount || 0),
        type: values.type,
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
        <div className="table-toolbar">
          <h2>Kassa</h2>
          <div className="toolbar-actions">
            <Button icon={<FiRefreshCw />} loading={isFetching} onClick={refetch}>
              Yangilash
            </Button>
            <Button
              className="hotel-primary-btn"
              icon={<FiSend />}
              disabled={!transactions.length}
              onClick={openCloseModal}
            >
              Kassani yopish
            </Button>
          </div>
        </div>

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
            {
              key: "payments",
              label: "To'lov olish",
              children: (
                <section className="cash-section">
                  <div className="cash-section-head">
                    <h3>To'lov qabul qilish</h3>
                    <span>{debtors.length} ta qarzdor mijoz</span>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
              <thead>
                <tr>
                  <th>Mijoz</th>
                  <th>Xona</th>
                  <th>Jami</th>
                  <th>To'langan</th>
                  <th>Qarz</th>
                  <th>Amal</th>
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
                    <td data-label="Amal">
                      <Button
                        className="hotel-primary-btn"
                        onClick={() => openPaymentModal(guest)}
                      >
                        To'lov olish
                      </Button>
                    </td>
                  </tr>
                ))}
                {!debtors.length ? (
                  <tr>
                    <td className="table-empty" colSpan={6}>
                      {debtorsLoading
                        ? "Qarzdorlar yuklanmoqda"
                        : "Qarzdor mijozlar yo'q"}
                    </td>
                  </tr>
                ) : null}
              </tbody>
                    </table>
                  </div>
                </section>
              ),
            },
            {
              key: "open",
              label: `Ochiq kassa (${transactions.length})`,
              children: (
                <section className="cash-section">
                  <div className="cash-section-head">
                    <h3>Ochiq to'lovlar</h3>
                    <span>{transactions.length} ta to'lov</span>
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
                </section>
              ),
            },
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
                    <td className="table-empty" colSpan={7}>
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
          <Form.Item
            name="amount"
            label="Summa"
            rules={[
              { required: true, message: "Summa majburiy" },
              { type: "number", min: 1, message: "Eng kamida 1 so'm" },
            ]}
          >
            <InputNumber
              min={1}
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
          <Form.Item
            name="type"
            label="To'lov turi"
            rules={[{ required: true, message: "To'lov turini tanlang" }]}
          >
            <Segmented
              block
              className="payment-type-segmented cash-payment-segmented"
              options={[
                { label: "Naqd", value: "naqd" },
                { label: "Karta", value: "karta" },
                { label: "Bank", value: "bank" },
              ]}
            />
          </Form.Item>
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
