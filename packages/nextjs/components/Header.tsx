"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useAdminWallet } from "~~/hooks/scaffold-eth/useAdminWallet";

type HeaderMenuLink = {
  label: string;
  href: string;
  adminOnly?: boolean;
  hideFromAdmin?: boolean;
  exactMatch?: boolean;
};

const MENU_LINKS: HeaderMenuLink[] = [
  {
    label: "Admin",
    href: "/admin",
    adminOnly: true,
    exactMatch: true,
  },
  {
    label: "Oracle Ops",
    href: "/admin/oracle",
    adminOnly: true,
  },
  {
    label: "Pool",
    href: "/pool",
    adminOnly: true,
  },
  {
    label: "Home",
    href: "/",
    hideFromAdmin: true,
  },
  {
    label: "Plans",
    href: "/insurance-plans",
    hideFromAdmin: true,
  },
  {
    label: "My Policies",
    href: "/my-policies",
    hideFromAdmin: true,
  },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();
  const { isAdmin } = useAdminWallet();
  const visibleMenuLinks = MENU_LINKS.filter(link => {
    if (link.adminOnly && !isAdmin) {
      return false;
    }

    if (link.hideFromAdmin && isAdmin) {
      return false;
    }

    return true;
  });

  return (
    <>
      {visibleMenuLinks.map(({ label, href, exactMatch }) => {
        const isActive = exactMatch
          ? pathname === href
          : pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
        return (
          <li key={href}>
            <Link
              href={href}
              className={`${
                isActive ? "bg-secondary shadow-md" : ""
              } hover:bg-secondary hover:shadow-md focus:!bg-secondary active:!text-neutral py-1.5 px-3 text-sm rounded-full`}
            >
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
};

/**
 * Site header
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div className="sticky lg:static top-0 navbar bg-base-100 min-h-0 shrink-0 justify-between z-20 shadow-md shadow-secondary px-0 sm:px-2">
      <div className="navbar-start w-auto lg:w-1/2">
        <details className="dropdown" ref={burgerMenuRef}>
          <summary className="ml-1 btn btn-ghost lg:hidden hover:bg-transparent">
            <Bars3Icon className="h-1/2" />
          </summary>
          <ul
            className="menu menu-compact dropdown-content mt-3 p-2 shadow-sm bg-base-100 rounded-box w-52"
            onClick={() => {
              burgerMenuRef?.current?.removeAttribute("open");
            }}
          >
            <HeaderMenuLinks />
          </ul>
        </details>
        <Link href="/" className="hidden lg:flex items-center gap-2 ml-4 mr-6 shrink-0">
          <div className="flex relative w-10 h-10">
            <Image alt="FlightSure logo" className="cursor-pointer" fill src="/logo.svg" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold leading-tight">FlightSure MVP</span>
            <span className="text-xs">Flight insurance console</span>
          </div>
        </Link>
        <ul className="hidden lg:flex lg:flex-nowrap menu menu-horizontal px-1 gap-2">
          <HeaderMenuLinks />
        </ul>
      </div>
      <div className="navbar-end grow mr-4">
        <RainbowKitCustomConnectButton />
        {isLocalNetwork && <FaucetButton />}
      </div>
    </div>
  );
};
