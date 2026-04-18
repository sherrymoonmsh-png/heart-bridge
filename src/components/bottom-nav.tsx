import Link from "next/link";

const tabs = [
  { key: "home", label: "心桥", href: "/community", icon: "⌂" },
  { key: "explore", label: "官方", href: "/explore", icon: "◎" },
  { key: "journal", label: "日记", href: "/diary", icon: "▣" },
  { key: "mine", label: "我的", href: "/profile", icon: "●" },
];

export function BottomNav({ active }: { active: string }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[390px] -translate-x-1/2 border-t border-black/5 bg-white/95 px-2 py-2 backdrop-blur">
      <ul className="grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                className={`flex flex-col items-center rounded-xl py-1 text-xs transition ${
                  isActive ? "text-primary" : "text-neutral-500"
                }`}
              >
                <span className="text-base leading-5">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
