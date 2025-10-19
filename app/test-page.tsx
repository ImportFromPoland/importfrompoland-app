export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-red-600">Test Page</h1>
      <p className="text-lg text-gray-600 mt-4">If you can see this with proper styling, the issue is with the ClientTabs component.</p>
      <div className="mt-8 p-4 bg-blue-100 rounded-lg">
        <p className="text-blue-800">This should have a blue background and proper styling.</p>
      </div>
    </div>
  );
}
