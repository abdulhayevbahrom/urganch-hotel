import { memo, useMemo, useRef, useState } from "react";
import { Alert, Button, DatePicker, Spin, Tabs } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/uz";
import { useNavigate } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import {
  FiActivity,
  FiBarChart2,
  FiClipboard,
  FiDollarSign,
  FiGrid,
  FiPrinter,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import PageLoader from "../components/PageLoader";
import {
  useGetDailyReportQuery,
  useGetReportsSummaryQuery,
  useGetSettingsQuery,
} from "../store/employeeApi";
import "./reports.css";

dayjs.locale("uz");

const formatMoney = (value) => Number(value || 0).toLocaleString("uz-UZ");

const formatCompactMoney = (value) => {
  const amount = Number(value || 0);
  if (amount >= 1_000_000_000)
    return `${(amount / 1_000_000_000).toFixed(1)} mlrd`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} mln`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)} ming`;
  return `${Math.round(amount)}`;
};

const REPORT_DESTINATIONS = {
  "finance.paymentRegistry": "/guests-history",
  "finance.roomRevenue": "/rooms",
  "finance.categoryRevenue": "/rooms",
  "finance.profitLoss": "/expenses",
  "finance.expenseBreakdown": "/expenses",
  "operations.occupancyHistory": "/rooms",
  "operations.bookings": "/guests-active",
  "operations.checkoutDelays": "/guests-debtors",
  "operations.hallBookings": "/hall-bookings",
  "guests.guestFlow": "/guests-history",
  "guests.debtAging": "/guests-debtors",
  "guests.vipGuests": "/guests-active",
  "guests.blacklist": "/guests-history",
  "guests.loyalGuests": "/guests-history",
  "extra.servicesRevenue": "/services",
  "extra.employeeActivity": "/employees",
};

const HIGHLIGHT_DESTINATIONS = {
  "Umumiy balans": "/guests-history",
  "To'langan": "/guests-history",
  Qarzdorlik: "/guests-debtors",
};

const createNavigateProps = (navigate, path, label) => ({
  role: "button",
  tabIndex: 0,
  "aria-label": label,
  onClick: () => navigate(path),
  onKeyDown: (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate(path);
    }
  },
});

const reportGroups = [
  {
    title: "Pul hisoboti",
    accent: "finance",
    icon: FiDollarSign,
    items: [
      {
        key: "finance.paymentRegistry",
        title: "To'lovlar ro'yxati",
        text: "Qaysi mijoz qachon va qancha to'lov qilganini ko'rsatadi.",
      },
      {
        key: "finance.roomRevenue",
        title: "Xonalar daromadi",
        text: "Qaysi xona ko'proq pul olib kelganini ko'rsatadi.",
      },
      {
        key: "finance.categoryRevenue",
        title: "Xona turlari daromadi",
        text: "Standart, lyuks va boshqa turdagi xonalar daromadini ko'rsatadi.",
      },
      {
        key: "finance.profitLoss",
        title: "Daromad va xarajat",
        text: "Qancha pul tushgani, qancha xarajat bo'lgani va qancha foyda qolgani ko'rinadi.",
      },
      {
        key: "finance.expenseBreakdown",
        title: "Xarajatlar taqsimoti",
        text: "Pul qaysi yo'nalishlarga sarflanganini ko'rsatadi.",
      },
    ],
  },
  {
    title: "Ish jarayoni",
    accent: "operations",
    icon: FiGrid,
    items: [
      {
        key: "operations.occupancyHistory",
        title: "Xonalar bandligi",
        text: "Xonalarning nechta qismi band ekanini ko'rsatadi.",
      },
      {
        key: "operations.bookings",
        title: "Bronlar soni",
        text: "Nechta bron borligini ko'rsatadi.",
      },
      {
        key: "operations.checkoutDelays",
        title: "Chiqish muddati o'tganlar",
        text: "Vaqtida chiqmagan mijozlar va ularning qarzini ko'rsatadi.",
      },
      {
        key: "operations.hallBookings",
        title: "Zal buyurtmalari",
        text: "Zal nechta marta buyurtma qilingani va qancha pul tushganini ko'rsatadi.",
      },
    ],
  },
  {
    title: "Mijozlar",
    accent: "guests",
    icon: FiUsers,
    items: [
      {
        key: "guests.guestFlow",
        title: "Kelgan va ketgan mijozlar",
        text: "Tanlangan oraliqda nechta mijoz kelgani va nechta mijoz ketganini ko'rsatadi.",
      },
      {
        key: "guests.debtAging",
        title: "Qarzdor mijozlar",
        text: "Qarzi bor mijozlar soni va umumiy qarz miqdorini ko'rsatadi.",
      },
      {
        key: "guests.vipGuests",
        title: "VIP mijozlar",
        text: "VIP mijozlar va VIP bo'lish uchun yuborilgan so'rovlarni ko'rsatadi.",
      },
      {
        key: "guests.blacklist",
        title: "Muammoli mijozlar",
        text: "Qora ro'yxatga tushgan mijozlar sonini ko'rsatadi.",
      },
      {
        key: "guests.loyalGuests",
        title: "Ko'p keladigan mijozlar",
        text: "Bir necha marta kelgan doimiy mijozlarni ko'rsatadi.",
      },
    ],
  },
  {
    title: "Qo'shimcha ma'lumotlar",
    accent: "extra",
    icon: FiActivity,
    items: [
      {
        key: "extra.servicesRevenue",
        title: "Xizmatlar daromadi",
        text: "Qo'shimcha xizmatlardan qancha pul tushganini ko'rsatadi.",
      },
      {
        key: "extra.employeeActivity",
        title: "Ishlayotgan hodimlar",
        text: "Hozir tizimda faol ishlayotgan hodimlar sonini ko'rsatadi.",
      },
    ],
  },
];

const getReportMetric = (key, sections = {}) => {
  const finance = sections?.finance || {};
  const operations = sections?.operations || {};
  const guests = sections?.guests || {};
  const extra = sections?.extra || {};

  switch (key) {
    case "finance.paymentRegistry":
      return {
        value: `${Number(finance?.paymentRegistry?.count || 0)} ta`,
        detail: `${formatCompactMoney(finance?.paymentRegistry?.totalAmount)} so'm`,
        meta: "Tanlangan oraliqda qilingan to'lovlar",
      };
    case "finance.roomRevenue":
      return {
        value: finance?.roomRevenue?.topRoomNumber || "-",
        detail: `${formatCompactMoney(finance?.roomRevenue?.topRoomAmount)} so'm`,
        meta: `${Number(finance?.roomRevenue?.activeRoomsCount || 0)} ta xona daromad keltirgan`,
      };
    case "finance.categoryRevenue":
      return {
        value: finance?.categoryRevenue?.topCategory || "-",
        detail: `${formatCompactMoney(finance?.categoryRevenue?.topCategoryAmount)} so'm`,
        meta: `${Number(finance?.categoryRevenue?.categoriesCount || 0)} ta xona turi`,
      };
    case "finance.profitLoss":
      return {
        value: `${formatCompactMoney(finance?.profitLoss?.net)} so'm`,
        detail: `Tushum ${formatCompactMoney(finance?.profitLoss?.revenue)} | Xarajat ${formatCompactMoney(finance?.profitLoss?.expense)}`,
        meta:
          Number(finance?.profitLoss?.net || 0) >= 0
            ? "Xarajatlardan keyin qolgan foyda"
            : "Xarajatlar ko'proq bo'lgan",
      };
    case "finance.expenseBreakdown":
      return {
        value: `${formatCompactMoney(finance?.expenseBreakdown?.totalAmount)} so'm`,
        detail: `${Number(finance?.expenseBreakdown?.categoriesCount || 0)} ta yo'nalish`,
        meta: "Pul qayerlarga sarflangan",
      };
    case "operations.occupancyHistory":
      return {
        value: `${Number(operations?.occupancyHistory?.occupancyPercent || 0)}%`,
        detail: `${Number(operations?.occupancyHistory?.occupiedRooms || 0)} / ${Number(operations?.occupancyHistory?.totalRooms || 0)} xona`,
        meta: "Hozirgi bandlik holati",
      };
    case "operations.bookings":
      return {
        value: `${Number(operations?.bookings?.count || 0)} ta`,
        detail: "Tanlangan oraliq uchun bronlar",
        meta: "Oldindan band qilingan xonalar",
      };
    case "operations.checkoutDelays":
      return {
        value: `${Number(operations?.checkoutDelays?.count || 0)} ta`,
        detail: `${formatCompactMoney(operations?.checkoutDelays?.totalDebt)} so'm`,
        meta: "Kechikib chiqayotgan mijozlar qarzi",
      };
    case "operations.hallBookings":
      return {
        value: `${Number(operations?.hallBookings?.count || 0)} ta`,
        detail: `${formatCompactMoney(operations?.hallBookings?.totalAmount)} so'm`,
        meta: `${formatCompactMoney(operations?.hallBookings?.totalDebt)} so'm qarz`,
      };
    case "guests.guestFlow":
      return {
        value: `${Number(guests?.guestFlow?.arrived || 0)} / ${Number(guests?.guestFlow?.left || 0)}`,
        detail: "Kelgan / ketgan mijozlar",
        meta: "Tanlangan oraliqdagi mijozlar harakati",
      };
    case "guests.debtAging":
      return {
        value: `${Number(guests?.debtAging?.count || 0)} ta`,
        detail: `${formatCompactMoney(guests?.debtAging?.totalDebt)} so'm`,
        meta: `${Number(guests?.debtAging?.over7Days || 0)} ta 7 kundan oshgan`,
      };
    case "guests.vipGuests":
      return {
        value: `${Number(guests?.vipGuests?.count || 0)} ta`,
        detail: `${Number(guests?.vipGuests?.pendingRequests || 0)} ta so'rov kutilmoqda`,
        meta: "Alohida kuzatiladigan mijozlar",
      };
    case "guests.blacklist":
      return {
        value: `${Number(guests?.blacklist?.count || 0)} ta`,
        detail: "Qora ro'yxatdagi mijozlar",
        meta: "Ehtiyot bo'lish kerak bo'lgan mijozlar",
      };
    case "guests.loyalGuests":
      return {
        value: `${Number(guests?.loyalGuests?.repeatGuests || 0)} ta`,
        detail: "Qayta kelgan mijozlar",
        meta: "Doimiy mijozlar soni",
      };
    case "extra.servicesRevenue":
      return {
        value: `${Number(extra?.servicesRevenue?.count || 0)} ta`,
        detail: `${formatCompactMoney(extra?.servicesRevenue?.totalAmount)} so'm`,
        meta: `${Number(extra?.servicesRevenue?.activeServices || 0)} ta faol xizmat turi`,
      };
    case "extra.employeeActivity":
      return {
        value: `${Number(extra?.employeeActivity?.activeEmployees || 0)} ta`,
        detail: "Faol hodimlar soni",
        meta: "Ishlayotgan hodimlar soni",
      };
    default:
      return {
        value: "-",
        detail: "Ma'lumot topilmadi",
        meta: "Hisobot hali tayyor emas",
      };
  }
};

function ReportsPage() {
  const navigate = useNavigate();
  const dailyReportRef = useRef(null);
  const [reportRange, setReportRange] = useState(() => [
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);
  const [activePreset, setActivePreset] = useState("");
  const [dailyReportDate, setDailyReportDate] = useState(() => dayjs());
  const [activeTab, setActiveTab] = useState("summary");
  const { data: settingsData } = useGetSettingsQuery();
  const hotelName =
    settingsData?.innerData?.hotelName ||
    localStorage.getItem("hotelName") ||
    "Mehmonxona nomi";
  const reportFrom = reportRange[0].format("YYYY-MM-DD");
  const reportTo = reportRange[1].format("YYYY-MM-DD");

  const { data, isLoading, isFetching, error } = useGetReportsSummaryQuery(
    { from: reportFrom, to: reportTo },
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
    },
  );
  const dailyDateKey = dailyReportDate.format("YYYY-MM-DD");
  const {
    data: dailyResponse,
    isFetching: isDailyReportFetching,
    error: dailyReportError,
  } = useGetDailyReportQuery(dailyDateKey, { skip: activeTab !== "daily" });

  const reportData = data?.innerData || {};
  const sections = reportData?.sections || {};
  const dailyReport = dailyResponse?.innerData;
  const dailyGuestRows = dailyReport?.guests || [];
  const dailyExpenses = dailyReport?.expenses?.items || [];

  const quickHighlights = useMemo(() => {
    const paid = Number(sections?.finance?.paymentRegistry?.totalAmount || 0);
    const debt = Number(sections?.guests?.debtAging?.totalDebt || 0);
    return [
      {
        title: "Umumiy balans",
        text: "To'langan va to'lanishi kerak bo'lgan jami summa",
        value: `${formatCompactMoney(paid + debt)} so'm`,
        icon: FiDollarSign,
      },
      {
        title: "To'langan",
        text: `${Number(sections?.finance?.paymentRegistry?.count || 0)} ta to'lov`,
        value: `${formatCompactMoney(paid)} so'm`,
        icon: FiBarChart2,
      },
      {
        title: "Qarzdorlik",
        text: `${Number(sections?.guests?.debtAging?.count || 0)} ta qarzdor mijoz`,
        value: `${formatCompactMoney(debt)} so'm`,
        icon: FiShield,
      },
    ];
  }, [sections]);

  const paymentMethodCards = useMemo(() => {
    const total = Number(sections?.finance?.paymentRegistry?.totalAmount || 0);
    const methods = sections?.finance?.paymentMethods || {};
    const makeItem = (key, title, amount) => ({
      key,
      title,
      amount: Number(amount || 0),
      percent: total > 0 ? (Number(amount || 0) / total) * 100 : 0,
    });
    return [
      makeItem("cash", "Naqd", methods.cash),
      makeItem("plastic", "Plastik karta", methods.card),
      makeItem("click", "Click", methods.click),
      makeItem("transfer", "Bank o'tkazmasi", methods.transfer),
    ];
  }, [sections]);

  const onReportRangeChange = (value) => {
    if (!value?.[0] || !value?.[1]) return;
    setActivePreset("");
    setReportRange([value[0].startOf("day"), value[1].endOf("day")]);
  };

  const selectPresetRange = (months) => {
    const currentMonth = dayjs();
    setActivePreset(String(months));
    if (months === 12) {
      setReportRange([
        currentMonth.startOf("year"),
        currentMonth.endOf("year"),
      ]);
      return;
    }

    setReportRange([
      currentMonth.subtract(months - 1, "month").startOf("month"),
      currentMonth.endOf("month"),
    ]);
  };

  const formatRoomLabel = (guest) => {
    const roomNumber = guest?.roomNumber ? String(guest.roomNumber) : "-";
    const korpus = guest?.korpus ? `[${guest.korpus}]` : "[-]";
    return (
      <>
        <span className="room-label-number">{roomNumber}</span> {korpus}
      </>
    );
  };

  const printDailyReport = useReactToPrint({
    content: () => dailyReportRef.current,
    documentTitle: `Kunlik-hisobot-${dailyReportDate.format("YYYY-MM-DD")}`,
    pageStyle: `
      @page { size: A4 landscape; margin: 8mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `,
  });

  if (isLoading && !data) {
    return (
      <PageLoader
        title="Hisobotlar tayyorlanmoqda"
        text="Backenddan analitik ma'lumotlar olinmoqda, bir oz kuting"
      />
    );
  }

  return (
    <div className="reports-page">
      <div className="page-card reports-shell">
        <section className="reports-hero">
          <div className="reports-hero-copy">
            <div className="reports-hero-actions">
              <div
                className="reports-range-presets"
                aria-label="Tezkor hisobot davrlari"
              >
                <Button
                  className={activePreset === "3" ? "is-active" : ""}
                  disabled={isFetching}
                  onClick={() => selectPresetRange(3)}
                >
                  3 oylik
                </Button>
                <Button
                  className={activePreset === "6" ? "is-active" : ""}
                  disabled={isFetching}
                  onClick={() => selectPresetRange(6)}
                >
                  6 oylik
                </Button>
                <Button
                  className={activePreset === "9" ? "is-active" : ""}
                  disabled={isFetching}
                  onClick={() => selectPresetRange(9)}
                >
                  9 oylik
                </Button>
                <Button
                  className={activePreset === "12" ? "is-active" : ""}
                  disabled={isFetching}
                  onClick={() => selectPresetRange(12)}
                >
                  Yillik
                </Button>
              </div>
              <DatePicker.RangePicker
                allowClear={false}
                value={reportRange}
                onChange={onReportRangeChange}
                format="DD.MM.YYYY"
                className="reports-range-picker"
              />
            </div>
          </div>

          <Spin spinning={isFetching} tip="Hisobot yangilanmoqda...">
            <div className="reports-overview-cards">
              <div className="reports-highlights">
                {quickHighlights.map((item, index) => {
                  const Icon = item.icon;
                  const destination =
                    HIGHLIGHT_DESTINATIONS[item.title] || "/reports";
                  return (
                    <article
                      key={item.title}
                      className={`reports-highlight-card reports-highlight-card-${index + 1} reports-clickable-card`}
                      {...createNavigateProps(
                        navigate,
                        destination,
                        `${item.title} bo'limini ochish`,
                      )}
                    >
                      <span className="reports-highlight-icon">
                        <Icon size={16} />
                      </span>
                      <strong>{item.title}</strong>
                      <div className="reports-highlight-value">
                        {item.value}
                      </div>
                      <p>{item.text}</p>
                    </article>
                  );
                })}
              </div>
              <div className="reports-payment-methods">
                {paymentMethodCards.map((method) => (
                  <article
                    key={method.key}
                    className={`reports-payment-method-card reports-payment-method-${method.key}`}
                  >
                    <div>
                      <strong>{method.title}</strong>
                      <span>{method.percent.toFixed(1)}%</span>
                    </div>
                    <b>{formatMoney(method.amount)} so'm</b>
                    <div className="reports-payment-method-progress">
                      <i
                        style={{ width: `${Math.min(method.percent, 100)}%` }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </Spin>
        </section>

        {error ? (
          <section className="reports-footer-note">
            <span className="reports-footer-icon">
              <FiClipboard size={15} />
            </span>
            Hisobotlarni backenddan olishda xatolik yuz berdi. API javobini
            tekshirib, qayta yuklash kerak bo'ladi.
          </section>
        ) : null}

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="reports-tabs"
          items={[
            {
              key: "summary",
              label: "Hisobotlar",
              children: (
                <>
                  <section className="reports-groups">
                    {reportGroups.map((group) => {
                      const Icon = group.icon;
                      return (
                        <article
                          key={group.title}
                          className={`reports-group-card reports-group-${group.accent}`}
                        >
                          <header className="reports-group-head">
                            <span className="reports-group-icon">
                              <Icon size={17} />
                            </span>
                            <div>
                              <h3>{group.title}</h3>
                              <p>{group.items.length} ta hisobot yo'nalishi</p>
                            </div>
                          </header>

                          <div className="reports-item-list">
                            {group.items.map((item) => {
                              const metric = getReportMetric(
                                item.key,
                                sections,
                              );
                              const destination =
                                REPORT_DESTINATIONS[item.key] || "/reports";

                              return (
                                <div
                                  key={item.title}
                                  className="reports-item-card reports-clickable-card"
                                  {...createNavigateProps(
                                    navigate,
                                    destination,
                                    `${item.title} bo'limini ochish`,
                                  )}
                                >
                                  <div className="reports-item-title-row">
                                    <b>{item.title}</b>
                                    <div className="reports-item-badge">
                                      <span className="reports-item-badge-value">
                                        {isFetching ? "..." : metric.value}
                                      </span>
                                      <small className="reports-item-badge-detail">
                                        {isFetching
                                          ? "Yangilanmoqda"
                                          : metric.detail}
                                      </small>
                                    </div>
                                  </div>
                                  <p>{item.text}</p>
                                  <div className="reports-item-meta">
                                    {metric.meta}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </section>

                  <section className="reports-footer-note">
                    <span className="reports-footer-icon">
                      <FiClipboard size={15} />
                    </span>
                    Jami tushum:{" "}
                    {formatMoney(sections?.finance?.profitLoss?.revenue)} so'm.
                    Jami xarajat:{" "}
                    {formatMoney(sections?.finance?.profitLoss?.expense)} so'm.
                    Yangilangan vaqt:{" "}
                    {reportData?.generatedAt
                      ? dayjs(reportData.generatedAt).format("DD.MM.YYYY HH:mm")
                      : "-"}
                    .
                  </section>
                </>
              ),
            },
            {
              key: "daily",
              label: "Kunlik hisobot",
              children: (
                <div className="daily-report-tab">
                  <div className="daily-report-toolbar">
                    <span>Hisobot sanasi</span>
                    <DatePicker
                      allowClear={false}
                      value={dailyReportDate}
                      onChange={(value) => value && setDailyReportDate(value)}
                      disabledDate={(current) =>
                        current &&
                        current.startOf("day").isAfter(dayjs().startOf("day"))
                      }
                      format="DD.MM.YYYY"
                    />
                    <small></small>
                    <Button
                      type="primary"
                      icon={<FiPrinter size={16} />}
                      disabled={
                        isDailyReportFetching ||
                        !dailyReport ||
                        Boolean(dailyReportError)
                      }
                      onClick={printDailyReport}
                    >
                      Chop etish
                    </Button>
                  </div>

                  {dailyReportError ? (
                    <Alert
                      type="error"
                      showIcon
                      message="Kunlik hisobotni olishda xatolik yuz berdi"
                    />
                  ) : null}

                  <Spin
                    spinning={isDailyReportFetching}
                    tip="Hisobot yuklanmoqda..."
                  >
                    <div className="daily-report-preview-wrap">
                      <div ref={dailyReportRef} className="daily-report-sheet">
                        <header className="daily-report-excel-head">
                          <strong>H I S O B O T</strong>
                          <span>
                            "{hotelName}" mehmonxonasida yashash bo'yicha kunlik
                            hisobot
                          </span>
                          <em>{dailyReportDate.format("DD MMMM YYYY")}</em>
                        </header>

                        <section className="daily-report-section">
                          <div className="daily-report-section-head">
                            <h2>Aktiv mijozlar ro'yxati</h2>
                            <span>{dailyGuestRows.length} ta xona</span>
                          </div>
                          <table className="daily-report-table daily-report-guest-table">
                            <colgroup>
                              <col className="report-col-prepayment" />
                              <col className="report-col-debt" />
                              <col className="report-col-room" />
                              <col className="report-col-count" />
                              <col className="report-col-daily" />
                              <col className="report-col-cash" />
                              <col className="report-col-card" />
                              <col className="report-col-click" />
                              <col className="report-col-transfer" />
                              <col className="report-col-total" />
                              <col className="report-col-name" />
                              <col className="report-col-name" />
                              <col className="report-col-prepayment-end" />
                              <col className="report-col-debt-end" />
                            </colgroup>
                            <thead>
                              <tr>
                                <th rowSpan={2}>Oldindan to'lov</th>
                                <th rowSpan={2}>Oldingi qarz</th>
                                <th rowSpan={2}>Xona №</th>
                                <th rowSpan={2}>Mijozlar soni</th>
                                <th rowSpan={2}>Bir kunlik to'lov</th>
                                <th colSpan={4}>To'lov usullari</th>
                                <th rowSpan={2}>Jami</th>
                                <th rowSpan={2}>F.I.Sh.</th>
                                <th rowSpan={2}>Tashkilot / INN</th>
                                <th rowSpan={2}>Oldindan to'lov</th>
                                <th rowSpan={2}>Joriy qarzdorlik</th>
                              </tr>
                              <tr>
                                <th>Naqd</th>
                                <th>Plastik karta</th>
                                <th>Click</th>
                                <th>Bank o'tkazmasi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dailyGuestRows.map((guest, index) => (
                                <tr
                                  key={`${guest.roomNumber}-${guest.fullName}-${index}`}
                                >
                                  <td>
                                    {formatMoney(guest.openingPrepayment)}
                                  </td>
                                  <td>{formatMoney(guest.openingDebt)}</td>
                                  <td>{formatRoomLabel(guest)}</td>
                                  <td>{guest.guestCount}</td>
                                  <td>
                                    <div className="daily-report-rate-cell">
                                      <strong>
                                        1 x{" "}
                                        {formatMoney(
                                          Number(guest.dailyRate || 0) /
                                            Math.max(
                                              Number(guest.guestCount || 1),
                                              1,
                                            ),
                                        )}
                                      </strong>
                                      <span>
                                        Jami: {formatMoney(guest.dailyRate)}
                                      </span>
                                    </div>
                                  </td>
                                  <td>{formatMoney(guest.cash)}</td>
                                  <td>{formatMoney(guest.card)}</td>
                                  <td>{formatMoney(guest.click)}</td>
                                  <td>{formatMoney(guest.transfer)}</td>
                                  <td>
                                    {formatMoney(
                                      (guest.cash || 0) +
                                        (guest.card || 0) +
                                        (guest.click || 0) +
                                        (guest.transfer || 0),
                                    )}
                                  </td>
                                  <td>{guest.fullName}</td>
                                  <td>
                                    <div className="daily-report-org-cell">
                                      <strong>
                                        {guest.organization || "-"}
                                      </strong>
                                      {guest.organizationInn ? (
                                        <span>
                                          INN: {guest.organizationInn}
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td>
                                    {formatMoney(guest.closingPrepayment)}
                                  </td>
                                  <td>{formatMoney(guest.closingDebt)}</td>
                                </tr>
                              ))}
                              {!dailyGuestRows.length ? (
                                <tr>
                                  <td
                                    colSpan={14}
                                    style={{ textAlign: "center" }}
                                  >
                                    Aktiv mijozlar topilmadi
                                  </td>
                                </tr>
                              ) : null}
                              {dailyGuestRows.length ? (
                                <tr className="daily-report-total-row">
                                  <td>
                                    {formatMoney(
                                      dailyGuestRows.reduce(
                                        (sum, row) =>
                                          sum +
                                          Number(row.openingPrepayment || 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td>
                                    {formatMoney(
                                      dailyGuestRows.reduce(
                                        (sum, row) =>
                                          sum + Number(row.openingDebt || 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td>Jami</td>
                                  <td>
                                    {dailyGuestRows.reduce(
                                      (sum, row) =>
                                        sum + Number(row.guestCount || 0),
                                      0,
                                    )}
                                  </td>
                                  <td>
                                    <div className="daily-report-rate-cell">
                                      <strong>Jami kunlik</strong>
                                      <span>
                                        {formatMoney(
                                          dailyGuestRows.reduce(
                                            (sum, row) =>
                                              sum + Number(row.dailyRate || 0),
                                            0,
                                          ),
                                        )}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    {formatMoney(
                                      dailyGuestRows.reduce(
                                        (sum, row) =>
                                          sum + Number(row.cash || 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td>
                                    {formatMoney(
                                      dailyGuestRows.reduce(
                                        (sum, row) =>
                                          sum + Number(row.card || 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td>
                                    {formatMoney(
                                      dailyGuestRows.reduce(
                                        (sum, row) =>
                                          sum + Number(row.click || 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td>
                                    {formatMoney(
                                      dailyGuestRows.reduce(
                                        (sum, row) =>
                                          sum + Number(row.transfer || 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td>
                                    {formatMoney(
                                      dailyGuestRows.reduce(
                                        (sum, row) =>
                                          sum +
                                          Number(row.cash || 0) +
                                          Number(row.card || 0) +
                                          Number(row.click || 0) +
                                          Number(row.transfer || 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td />
                                  <td />
                                  <td>
                                    {formatMoney(
                                      dailyGuestRows.reduce(
                                        (sum, row) =>
                                          sum +
                                          Number(row.closingPrepayment || 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td>
                                    {formatMoney(
                                      dailyGuestRows.reduce(
                                        (sum, row) =>
                                          sum + Number(row.closingDebt || 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </section>

                        <section className="daily-report-section">
                          <div className="daily-report-section-head">
                            <h2>Kunlik xarajatlar</h2>
                            <span>{dailyExpenses.length} ta xarajat</span>
                          </div>
                          <table className="daily-report-table daily-report-expense-table">
                            <colgroup>
                              <col className="report-col-name" />
                              <col className="report-col-room" />
                              <col className="report-col-count" />
                              <col className="report-col-daily" />
                              <col className="report-col-total" />
                            </colgroup>
                            <thead>
                              <tr>
                                <th>Nomi</th>
                                <th>Kategoriya</th>
                                <th>To'lov usuli</th>
                                <th>Summa</th>
                                <th>Izoh</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dailyExpenses.map((expense, index) => (
                                <tr
                                  key={`${expense.title}-${expense.category}-${index}`}
                                >
                                  <td>{expense.title || "-"}</td>
                                  <td>{expense.category || "-"}</td>
                                  <td>{expense.paymentType || "-"}</td>
                                  <td>{formatMoney(expense.amount)}</td>
                                  <td>{expense.note || "-"}</td>
                                </tr>
                              ))}
                              {!dailyExpenses.length ? (
                                <tr>
                                  <td
                                    colSpan={5}
                                    style={{ textAlign: "center" }}
                                  >
                                    Tanlangan sana uchun xarajat topilmadi
                                  </td>
                                </tr>
                              ) : null}
                              {dailyExpenses.length ? (
                                <tr className="daily-report-total-row">
                                  <td>Jami</td>
                                  <td />
                                  <td />
                                  <td>
                                    {formatMoney(
                                      dailyExpenses.reduce(
                                        (sum, expense) =>
                                          sum + Number(expense.amount || 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td />
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </section>

                        <section className="daily-report-section daily-report-summary-grid">
                          <div className="daily-report-rows">
                            <div className="daily-report-rows-primary">
                              <span>Jami oldindan to'lov</span>
                              <b>
                                {formatMoney(
                                  dailyGuestRows.reduce(
                                    (sum, row) =>
                                      sum + Number(row.closingPrepayment || 0),
                                    0,
                                  ),
                                )}{" "}
                                so'm
                              </b>
                            </div>
                            <div>
                              <span>Jami aktiv xonalar</span>
                              <b>
                                {Number(
                                  dailyReport?.operations?.occupiedRooms || 0,
                                )}{" "}
                                ta
                              </b>
                            </div>
                            <div>
                              <span>Jami aktiv mijozlar</span>
                              <b>
                                {Number(dailyReport?.operations?.guests || 0)}{" "}
                                ta
                              </b>
                            </div>
                            <div>
                              <span>Jami qarzdorlar</span>
                              <b>
                                {Number(dailyReport?.debt?.debtors || 0)} ta
                              </b>
                            </div>
                            <div>
                              <span>Jami qarz</span>
                              <b>
                                {formatMoney(dailyReport?.debt?.total)} so'm
                              </b>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  </Spin>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

export default memo(ReportsPage);
