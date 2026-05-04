import { dag, Directory, object, func } from "@dagger.io/dagger"

@object()
class ElectronLink {
  @func()
  async ci(
    /**
     * +defaultPath="."
     */
    src: Directory,
  ): Promise<void> {
    await dag
      .container()
      .from("node:20")
      .withDirectory("/repo", src)
      .withWorkdir("/repo")
      .withExec(["npm", "install"])
      .withExec(["npm", "test"])
      .sync()
  }
}
