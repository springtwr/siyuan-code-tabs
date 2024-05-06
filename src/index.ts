import {Plugin} from "siyuan";
import "@/index.scss";

export default class PluginSample extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);

    async onload() {
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
        console.log("loading plugin: code-tabs", this.i18n);
        console.log(this.i18n.helloPlugin);
    }

    async onunload() {
        console.log(this.i18n.byePlugin);
        console.log("onunload");
    }

    uninstall() {
        console.log("uninstall");
    }

    private blockIconEvent({detail}: any) {
        detail.menu.addItem({
            iconHTML: "",
            label: this.i18n.removeSpace,
            click: () => {
                detail.blockElements.forEach((item: HTMLElement) => {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement) {

                    }
                });
            }
        });
    }
}
