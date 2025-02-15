import React from "react";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-gray-300 py-4 w-full">
      <div className="mt-2 text-center text-sm border-t border-gray-700 pt-2">
        © {new Date().getFullYear()} Retailer Portal. All Rights Reserved.
      </div>
    </footer>
  );
};

export default Footer;
