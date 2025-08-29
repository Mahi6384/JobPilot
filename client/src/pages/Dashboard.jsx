import ShowJobs from "../components/ShowJobs";

function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-950 overflow-y-auto scrollbar-none p-4">
      <h1 className="text-white text-3xl font-montserrat font-semibold pl-10 pb-5">
        New Generated Jobs
      </h1>
      <ShowJobs />
    </div>
  );
}

export default Dashboard;
