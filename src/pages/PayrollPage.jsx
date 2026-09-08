import { useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Tabs,
} from "antd";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import { FiDollarSign, FiEdit2, FiMinus, FiPlus, FiTrash2 } from "react-icons/fi";
import {
  useCreatePayrollMutation,
  useDeletePayrollActionMutation,
  useGetEmployeesQuery,
  useGetPayrollHistoryQuery,
  useGetPayrollsQuery,
  useUpdatePayrollActionMutation,
  useUpdatePayrollMutation,
} from "../store/employeeApi";
import {
  blockNonIntegerKeys,
  preventInvalidAmountPaste,
} from "../utils/numberFormat";
import PageLoader from "../components/PageLoader";
import "./payroll.css";

const formatMoney = (value) => Number(value || 0).toLocaleString();
const paymentTypeOptions = [
  { label: "Naqd", value: "naqd" },
  { label: "Karta", value: "karta" },
  { label: "Click", value: "click" },
  { label: "Bank", value: "bank" },
];

const getEmployeeName = (employee) =>
  `${employee?.firstname || ""} ${employee?.lastname || ""}`.trim() || "-";
const actionTypeLabel = {
  payment: "Oylik berildi",
  bonus: "Bonus",
  deduction: "Jarima",
};
const actionTypeOptions = [
  { label: "Barchasi", value: "" },
  { label: "Oylik", value: "payment" },
  { label: "Bonus", value: "bonus" },
  { label: "Jarima", value: "deduction" },
];

function PayrollPage() {
  const [form] = Form.useForm();
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [activeTab, setActiveTab] = useState("current");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyType, setHistoryType] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("salary");
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [editingAction, setEditingAction] = useState(null);
  const selectedEmployeeId = Form.useWatch("employeeId", form);

  const { employees, isEmployeesLoading } = useGetEmployeesQuery(undefined, {
    selectFromResult: ({ data, isLoading }) => ({
      employees: data?.innerData || [],
      isEmployeesLoading: isLoading,
    }),
  });
  const { data, isLoading } = useGetPayrollsQuery({ month });
  const { data: historyData, isLoading: loadingHistory } =
    useGetPayrollHistoryQuery({
      month,
      query: historyQuery,
      type: historyType,
      page: historyPage,
      limit: 25,
    });
  const [createPayroll, { isLoading: creating }] = useCreatePayrollMutation();
  const [updatePayroll, { isLoading: updating }] = useUpdatePayrollMutation();
  const [updatePayrollAction, { isLoading: updatingAction }] =
    useUpdatePayrollActionMutation();
  const [deletePayrollAction, { isLoading: deletingAction }] =
    useDeletePayrollActionMutation();

  const payload = data?.innerData || {};
  const payrolls = payload.items || [];
  const historyItems = historyData?.innerData?.items || [];
  const historyPagination = historyData?.innerData?.pagination || {
    page: 1,
    limit: 25,
    total: 0,
  };
  const summary = payload.summary || {};
  const employeeOptions = employees.map((employee) => ({
    label: `${getEmployeeName(employee)} - ${employee.position}`,
    value: employee._id,
  }));

  const openEmployeeActionModal = (payroll, mode) => {
    const employee = payroll.employee;
    setModalMode(mode);
    setSelectedPayroll(payroll);
    setEditingAction(null);
    form.resetFields();
    form.setFieldsValue({
      employeeId: employee?._id,
      month: dayjs(month),
      baseSalary: Number(employee?.salary || 0),
      paidAt: dayjs(),
      paymentType: payroll.paymentType || "naqd",
      bonus: Number(payroll.bonus || 0),
      deduction: Number(payroll.deduction || 0),
      paidAmount: mode === "salary" ? Number(payroll.paidAmount || employee?.salary || 0) : 0,
      amount: 0,
      note: "",
    });
    setIsModalOpen(true);
  };

  const openEditActionModal = (item) => {
    setModalMode("edit-action");
    setSelectedPayroll({ _id: item.payrollId, employee: item.employee, isPaid: true });
    setEditingAction(item);
    form.resetFields();
    form.setFieldsValue({
      employeeId: item.employee?._id,
      month: dayjs(item.month),
      amount: Number(item.amount || 0),
      paymentType: item.paymentType || "naqd",
      note: item.note || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPayroll(null);
    setEditingAction(null);
    form.resetFields();
  };

  const onSubmit = async (values) => {
    try {
      if (modalMode === "edit-action") {
        const result = await updatePayrollAction({
          id: editingAction.payrollId,
          actionId: editingAction._id,
          type: editingAction.type,
          amount: Number(values.amount || 0),
          paymentType: values.paymentType || "naqd",
          date: values.month?.format ? values.month.format("YYYY-MM-DD") : undefined,
          note: String(values.note || "").trim(),
        }).unwrap();
        toast.success(result?.message || "Yozuv yangilandi");
        closeModal();
        return;
      }

      const actionType =
        modalMode === "salary"
          ? "payment"
          : modalMode === "bonus"
            ? "bonus"
            : "deduction";
      const body = {
        employeeId: values.employeeId,
        month: values.month?.format ? values.month.format("YYYY-MM") : values.month,
        baseSalary: Number(values.baseSalary || 0),
        type: actionType,
        amount:
          modalMode === "salary" ? Number(values.paidAmount || 0) : Number(values.amount || 0),
        bonus: modalMode === "bonus" ? Number(values.amount || 0) : 0,
        deduction: modalMode === "deduction" ? Number(values.amount || 0) : 0,
        paidAmount:
          modalMode === "salary" ? Number(values.paidAmount || 0) : 0,
        paymentType: values.paymentType || selectedPayroll?.paymentType || "naqd",
        paidAt: values.paidAt ? values.paidAt.format("YYYY-MM-DD") : undefined,
        note: String(values.note || "").trim(),
      };
      const result =
        selectedPayroll?.isPaid && !String(selectedPayroll?._id || "").startsWith("draft-")
          ? await updatePayroll({ id: selectedPayroll._id, ...body }).unwrap()
          : await createPayroll(body).unwrap();
      toast.success(result?.message || "Oylik saqlandi");
      closeModal();
    } catch (err) {
      toast.error(err?.data?.message || "Oylikni saqlashda xatolik");
    }
  };

  const onDeleteAction = async (item) => {
    try {
      const result = await deletePayrollAction({
        id: item.payrollId,
        actionId: item._id,
      }).unwrap();
      toast.success(result?.message || "Yozuv o'chirildi");
    } catch (err) {
      toast.error(err?.data?.message || "Yozuvni o'chirishda xatolik");
    }
  };

  const onEmployeeChange = (employeeId) => {
    const employee = employees.find((item) => item._id === employeeId);
    form.setFieldsValue({ baseSalary: Number(employee?.salary || 0) });
  };

  if (isLoading || isEmployeesLoading) return <PageLoader />;

  return (
    <div className="employee-page payroll-page">
      <div className="page-card payroll-shell">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "current",
              label: "Hozirgi holat",
              children: (
                <div className="payroll-tab-panel">
                  <div className="table-toolbar payroll-tab-toolbar">
                    <h2>Hozirgi holat</h2>
                    <div className="toolbar-actions">
                      <DatePicker
                        picker="month"
                        value={dayjs(month)}
                        format="YYYY-MM"
                        onChange={(value) => setMonth(value ? value.format("YYYY-MM") : "")}
                      />
                    </div>
                  </div>

                  <div className="payroll-summary">
                    <div>
                      <span>Oylik fondi</span>
                      <strong>{formatMoney(summary.totalSalary)} so'm</strong>
                    </div>
                    <div>
                      <span>Berilgan</span>
                      <strong>{formatMoney(summary.totalPaid)} so'm</strong>
                    </div>
                    <div>
                      <span>Hodim haqi</span>
                      <strong>{formatMoney(summary.totalCredit)} so'm</strong>
                    </div>
                    <div>
                      <span>Hodim qarzi</span>
                      <strong>{formatMoney(summary.totalDebt)} so'm</strong>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="hotel-table payroll-table">
            <thead>
              <tr>
                <th>Hodim</th>
                <th>Oy</th>
                <th>Eski balans</th>
                <th>Oylik</th>
                <th>Qo'shimcha</th>
                <th>Ushlanma</th>
                <th>Berildi</th>
                <th>Amal</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.map((payroll) => (
                <tr key={payroll._id}>
                  <td data-label="Hodim">
                    <strong>{getEmployeeName(payroll.employee)}</strong>
                    <small>{payroll.employee?.position || "-"}</small>
                  </td>
                  <td data-label="Oy">{payroll.month}</td>
                  <td data-label="Eski balans">{formatMoney(payroll.previousBalance)}</td>
                  <td data-label="Oylik">{formatMoney(payroll.baseSalary)}</td>
                  <td data-label="Qo'shimcha">{formatMoney(payroll.bonus)}</td>
                  <td data-label="Ushlanma">{formatMoney(payroll.deduction)}</td>
                  <td data-label="Berildi">{formatMoney(payroll.paidAmount)}</td>
                  <td data-label="Amal">
                    <div className="table-action-wrap">
                      <Button
                        type="primary"
                        size="small"
                        className="payroll-action salary"
                        icon={<FiDollarSign />}
                        onClick={() => openEmployeeActionModal(payroll, "salary")}
                      >
                        Oylik berish
                      </Button>
                      <button
                        className="icon-btn payroll-action bonus"
                        type="button"
                        aria-label="Bonus qo'shish"
                        title="Bonus qo'shish"
                        onClick={() => openEmployeeActionModal(payroll, "bonus")}
                      >
                        <FiPlus />
                      </button>
                      <button
                        className="icon-btn payroll-action fine"
                        type="button"
                        aria-label="Jarima yozish"
                        title="Jarima yozish"
                        onClick={() => openEmployeeActionModal(payroll, "deduction")}
                      >
                        <FiMinus />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!payrolls.length ? (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    Bu oy uchun oylik yozuvlari yo'q
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
                  </div>
                </div>
              ),
            },
            {
              key: "history",
              label: "Tarix",
              children: (
                <div className="payroll-tab-panel">
                  <div className="table-toolbar payroll-tab-toolbar">
                    <h2>Oylik tarixi</h2>
                    <div className="toolbar-actions">
                      <Input
                        className="search-input"
                        placeholder="Hodim bo'yicha qidirish"
                        value={historyQuery}
                        onChange={(event) => {
                          setHistoryPage(1);
                          setHistoryQuery(event.target.value);
                        }}
                      />
                      <Select
                        className="payroll-history-type-filter"
                        options={actionTypeOptions}
                        value={historyType}
                        onChange={(value) => {
                          setHistoryPage(1);
                          setHistoryType(value);
                        }}
                      />
                      <DatePicker
                        picker="month"
                        value={dayjs(month)}
                        format="YYYY-MM"
                        onChange={(value) => {
                          setHistoryPage(1);
                          setMonth(value ? value.format("YYYY-MM") : "");
                        }}
                      />
                    </div>
                  </div>
                  {loadingHistory ? (
                    <PageLoader />
                  ) : (
                    <div className="table-wrap">
                      <table className="hotel-table payroll-table payroll-history-table is-small">
                        <thead>
                          <tr>
                            <th>Hodim</th>
                            <th>Oy</th>
                            <th>Tur</th>
                            <th>Summa</th>
                            <th>To'lov turi</th>
                            <th>Izoh</th>
                            <th>Amal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyItems.map((item) => (
                            <tr
                              key={`${item.payrollId}-${item._id}`}
                              className={`payroll-history-row is-${item.type}`}
                            >
                              <td data-label="Hodim">
                                <strong>{getEmployeeName(item.employee)}</strong>
                                <small>{item.employee?.position || "-"}</small>
                              </td>
                              <td data-label="Oy">{item.month}</td>
                              <td data-label="Tur">
                                <span className={`payroll-type-badge is-${item.type}`}>
                                  {actionTypeLabel[item.type] || item.type}
                                </span>
                              </td>
                              <td data-label="Summa">
                                <strong className={`payroll-history-amount is-${item.type}`}>
                                  {formatMoney(item.amount)}
                                </strong>
                              </td>
                              <td data-label="To'lov turi">{item.paymentType || "-"}</td>
                              <td data-label="Izoh">{item.note || "-"}</td>
                              <td data-label="Amal">
                                <div className="table-action-wrap">
                                  <button
                                    className="icon-btn payroll-action edit"
                                    type="button"
                                    title="Tahrirlash"
                                    onClick={() => openEditActionModal(item)}
                                  >
                                    <FiEdit2 />
                                  </button>
                                  <Popconfirm
                                    title="Yozuvni o'chirish"
                                    description="Ushbu yozuvni o'chirasizmi?"
                                    okText="O'chirish"
                                    cancelText="Bekor"
                                    okButtonProps={{ danger: true, loading: deletingAction }}
                                    onConfirm={() => onDeleteAction(item)}
                                    overlayClassName="hotel-popconfirm"
                                  >
                                    <button className="icon-btn danger" type="button" title="O'chirish">
                                      <FiTrash2 />
                                    </button>
                                  </Popconfirm>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!historyItems.length ? (
                            <tr>
                              <td colSpan={7} className="empty-cell">
                                Tarix yozuvlari topilmadi
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                      <div className="payroll-history-pagination">
                        <span>So'nggi 25 ta amal</span>
                        <Pagination
                          current={historyPagination.page}
                          pageSize={historyPagination.limit}
                          total={historyPagination.total}
                          showSizeChanger={false}
                          onChange={setHistoryPage}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={
          modalMode === "bonus"
            ? "Bonus qo'shish"
            : modalMode === "deduction"
              ? "Jarima yozish"
              : modalMode === "edit-action"
                ? "Yozuvni tahrirlash"
                : "Oylik berish"
        }
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnClose
        className="hotel-modal payroll-modal"
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="employeeId" label="Hodim" rules={[{ required: true }]}>
            <Select
              showSearch
              options={employeeOptions}
              placeholder="Hodimni tanlang"
              optionFilterProp="label"
              onChange={onEmployeeChange}
              disabled={Boolean(selectedEmployeeId)}
            />
          </Form.Item>
          <Form.Item name="month" label="Oy" rules={[{ required: true }]}>
            <DatePicker
              picker="month"
              format="YYYY-MM"
              className="payroll-modal-control"
            />
          </Form.Item>
          <Form.Item name="baseSalary" hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item name="bonus" hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item name="deduction" hidden>
            <InputNumber />
          </Form.Item>
          {modalMode === "salary" ? (
            <div className="form-grid two">
            <Form.Item name="paidAmount" label="Beriladigan summa" rules={[{ required: true }]}>
              <InputNumber
                min={0}
                controls={false}
                className="payroll-modal-control"
                onKeyDown={blockNonIntegerKeys}
                onPaste={preventInvalidAmountPaste}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
                parser={(value) => value?.replace(/\s/g, "")}
              />
            </Form.Item>
            <Form.Item name="paymentType" label="To'lov turi" rules={[{ required: true }]}>
              <Select options={paymentTypeOptions} />
            </Form.Item>
            </div>
          ) : (
            <Form.Item
              name="amount"
              label={
                modalMode === "edit-action"
                  ? "Summa"
                  : modalMode === "bonus"
                    ? "Bonus summasi"
                    : "Jarima summasi"
              }
              rules={[{ required: true }]}
            >
              <InputNumber
                min={0}
                controls={false}
                className="payroll-modal-control"
                onKeyDown={blockNonIntegerKeys}
                onPaste={preventInvalidAmountPaste}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
                parser={(value) => value?.replace(/\s/g, "")}
              />
            </Form.Item>
          )}
          {modalMode === "edit-action" && editingAction?.type === "payment" ? (
            <Form.Item name="paymentType" label="To'lov turi" rules={[{ required: true }]}>
              <Select options={paymentTypeOptions} />
            </Form.Item>
          ) : null}

          <Form.Item name="note" label="Izoh">
            <Input.TextArea rows={3} />
          </Form.Item>
          <div className="modal-actions">
            <Button onClick={closeModal}>Bekor</Button>
            <Button type="primary" htmlType="submit" loading={creating || updating}>
              Saqlash
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default PayrollPage;
