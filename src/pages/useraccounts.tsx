import React, { useState } from 'react';
import { User, Settings, Smartphone, LogOut, Check } from 'lucide-react';

export default function ProfileMenu() {
  const [selectedAccount, setSelectedAccount] = useState('joshuapaco');

  const accounts = [
    {
      id: 'joshuapaco',
      name: "Joshua Paco",
      handle: '@joshuapaco',
      avatar: 'https://i.pinimg.com/736x/7e/93/08/7e9308642278a24707bddc9f79ec60c9.jpg'
    },
    {
      id: 'isles',
      name: 'Shad Isles',
      handle: '@shadisles',
      avatar: 'https://i.pinimg.com/1200x/b1/1d/a5/b11da5b570acf34568a8ab0fe8b5917f.jpg '
    }
  ];

  const currentAccount = accounts.find(acc => acc.id === selectedAccount);

  const handleAccountSwitch = (accountId: string) => {
    setSelectedAccount(accountId);
  };

  const handleMyProfile = () => {
    console.log('Navigate to profile:', selectedAccount);
    if (currentAccount) {
      alert(`Navigating to ${currentAccount.name}'s profile`);
    }
  };

  const handleAccountSettings = () => {
    console.log('Opening account settings');
    alert('Opening Account Settings');
  };

  const handleDeviceManagement = () => {
    console.log('Opening device management');
    alert('Opening Device Management');
  };

  const handleSignOut = () => {
    console.log('Signing out');
    const confirmSignOut = window.confirm('Are you sure you want to sign out?');
    if (confirmSignOut) {
      alert('Signed out successfully');
    }
  };

  if (!currentAccount) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="bg-white rounded-t-3xl px-8 py-6 flex items-center gap-4 border-b border-gray-100 shadow-sm">
          <div className="relative">
            <img
              src={currentAccount.avatar}
              alt={currentAccount.name}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-blue-100"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">{currentAccount.name}</h2>
        </div>

        {/* Account Switcher */}
        <div className="bg-white px-6 py-5 border-b border-gray-100">
          <div className="space-y-3">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => handleAccountSwitch(account.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-all duration-200 group hover:shadow-sm"
              >
                <div className="relative">
                  <img
                    src={account.avatar}
                    alt={account.name}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-100"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-lg font-semibold text-gray-900">{account.name}</div>
                  <div className="text-base text-gray-500">{account.handle}</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                  selectedAccount === account.id
                    ? 'border-blue-500 bg-blue-500 shadow-sm'
                    : 'border-gray-300 bg-white'
                }`}>
                  {selectedAccount === account.id && (
                    <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Menu Options */}
        <div className="bg-white px-6 py-4">
          <button
            onClick={handleMyProfile}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-gray-50 transition-all duration-200 group hover:shadow-sm"
          >
            <User className="w-6 h-6 text-gray-500 group-hover:text-blue-600 transition-colors" />
            <span className="flex-1 text-left text-lg font-medium text-gray-700 group-hover:text-gray-900">
              My profile
            </span>
            <span className="text-base text-gray-500">{currentAccount.handle}</span>
          </button>

          <button
            onClick={handleAccountSettings}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-gray-50 transition-all duration-200 group hover:shadow-sm"
          >
            <Settings className="w-6 h-6 text-gray-500 group-hover:text-blue-600 transition-colors" />
            <span className="flex-1 text-left text-lg font-medium text-gray-700 group-hover:text-gray-900">
              Account settings
            </span>
          </button>

          <button
            onClick={handleDeviceManagement}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-gray-50 transition-all duration-200 group hover:shadow-sm"
          >
            <Smartphone className="w-6 h-6 text-gray-500 group-hover:text-blue-600 transition-colors" />
            <span className="flex-1 text-left text-lg font-medium text-gray-700 group-hover:text-gray-900">
              Device management
            </span>
          </button>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-red-50 transition-all duration-200 group hover:shadow-sm"
          >
            <LogOut className="w-6 h-6 text-gray-500 group-hover:text-red-600 transition-colors" />
            <span className="flex-1 text-left text-lg font-medium text-gray-700 group-hover:text-red-600">
              Sign out
            </span>
          </button>
        </div>

        {/* Footer */}
        <div className="bg-white rounded-b-3xl px-8 py-5 border-t border-gray-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br nrounded-xl flex items-center justify-center shadow-md">
              <div className="w-6 h-6 bg-white/90 rounded-lg" style={{ clipPath: 'polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)' }}></div>
            </div>
            <span className="text-lg font-semibold text-gray-900">The Crunch</span>
          </div>
          <span className="text-base text-gray-500 font-medium">v12.8.1</span>
        </div>
      </div>
    </div>
  );
}