import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white px-6">
      <h1 className="text-8xl font-extrabold text-red-500 mb-4 animate-pulse">
        404
      </h1>
      <h2 className="text-2xl font-semibold mb-4">Oops! Page Not Found</h2>
      <p className="text-gray-400 mb-6 text-center max-w-md">
        The page you are looking for might have been removed or is temporarily
        unavailable.
      </p>
      <Link href="/">
        <div className="mt-4 px-6 py-3 bg-red-600 text-white rounded-md shadow-md hover:bg-red-700 transition duration-300 cursor-pointer">
          Go Back Home
        </div>
      </Link>
    </div>
  );
}
