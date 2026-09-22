import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import AdminSidebar from "../components/AdminSidebar";
import AdminHeader from "../components/AdminHeader";
import { useGetSettingsQuery } from "../store/employeeApi";
import InstallPrompt from "../components/InstallPrompt";
import "./admin-layout.css";

function AdminLayout() {
  const { data: settingsData, isLoading } = useGetSettingsQuery();
  const hotelName = settingsData?.innerData?.hotelName || "Mehmonxona nomi";
  const isActive = settingsData?.innerData?.status !== false;

  useEffect(() => {
    document.title = hotelName;
    localStorage.setItem("hotelName", hotelName);
  }, [hotelName]);

  if (isLoading) return null;

  if (!isActive) {
    return (
      <main className="payment-error-page">
        <section className="payment-error-card" role="alert">
          <h1>Payment error</h1>
          <p>Hurmatli mijoz, to‘lovni amalga oshiring</p>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-main">
        <AdminHeader />
        <section className="admin-content">
          <Outlet />
        </section>
      </div>
      <InstallPrompt />
    </div>
  );
}

export default AdminLayout;
