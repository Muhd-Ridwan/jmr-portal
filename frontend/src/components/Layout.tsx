import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-page">
      <div className="sticky top-0 z-50">
        <Navbar />
      </div>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
