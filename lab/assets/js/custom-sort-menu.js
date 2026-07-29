(() => {
  const select = document.querySelector("#stock-sort");
  const box = select?.closest(".sort-box");
  if (!select || !box) return;

  box.classList.add("sort-enhanced");
  select.classList.add("sort-native-hidden");

  const custom = document.createElement("div");
  custom.className = "custom-sort";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-sort-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const menu = document.createElement("div");
  menu.className = "custom-sort-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "銘柄の表示順");

  const options = [...select.options];

  const closeMenu = () => {
    custom.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  };

  const sync = () => {
    const selected = options.find((option) => option.value === select.value) ?? options[0];
    trigger.textContent = selected?.textContent ?? "表示順を選択";
    menu.querySelectorAll(".custom-sort-option").forEach((button) => {
      button.setAttribute("aria-selected", String(button.dataset.value === select.value));
    });
  };

  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "custom-sort-option";
    button.dataset.value = option.value;
    button.textContent = option.textContent;
    button.setAttribute("role", "option");
    button.addEventListener("click", () => {
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
      closeMenu();
      trigger.focus();
    });
    menu.append(button);
  });

  trigger.addEventListener("click", () => {
    const willOpen = !custom.classList.contains("open");
    custom.classList.toggle("open", willOpen);
    trigger.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) menu.querySelector('[aria-selected="true"]')?.focus();
  });

  trigger.addEventListener("keydown", (event) => {
    if (["ArrowDown", "Enter", " "].includes(event.key) && !custom.classList.contains("open")) {
      event.preventDefault();
      custom.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      menu.querySelector('[aria-selected="true"]')?.focus();
    }
  });

  menu.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll(".custom-sort-option")];
    const index = items.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Escape") {
      closeMenu();
      trigger.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!custom.contains(event.target)) closeMenu();
  });

  select.addEventListener("change", sync);
  custom.append(trigger, menu);
  box.append(custom);
  sync();
})();